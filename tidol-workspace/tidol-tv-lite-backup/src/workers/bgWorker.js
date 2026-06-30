const vertexShaderSource = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec2 vUv;
  uniform float u_time;
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform vec3 u_color3;
  uniform vec2 u_resolution;

  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv.x *= u_resolution.x / u_resolution.y;

    // Fluid distortion using multiple noise layers
    float n1 = snoise(uv * 1.5 + u_time * 0.15);
    float n2 = snoise(uv * 2.5 - u_time * 0.2 + vec2(n1));
    float n3 = snoise(uv * 1.0 + u_time * 0.1 + vec2(n2));
    
    // Mix colors based on noise patterns
    vec3 color = mix(u_color1, u_color2, smoothstep(-1.0, 1.0, n1 + n2));
    color = mix(color, u_color3, smoothstep(-0.5, 1.0, n3));
    
    // Add subtle vignette
    vec2 puv = vUv - 0.5;
    float len = length(puv);
    color *= smoothstep(0.8, 0.2, len * 0.8);

    gl_FragColor = vec4(color, 1.0);
  }
`;

let gl = null;
let program = null;
let timeLocation = null;
let color1Location = null;
let color2Location = null;
let color3Location = null;
let resolutionLocation = null;
let animationFrameId = null;

let currentColor1 = [0.1, 0.1, 0.1];
let currentColor2 = [0.05, 0.05, 0.05];
let currentColor3 = [0.0, 0.0, 0.0];

let targetColor1 = [0.1, 0.1, 0.1];
let targetColor2 = [0.05, 0.05, 0.05];
let targetColor3 = [0.0, 0.0, 0.0];

const lerp = (a, b, t) => a + (b - a) * t;

const hexToRgb = (hex) => {
    if (!hex) return [0, 0, 0];
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return [r / 255, g / 255, b / 255];
};

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function initWebGL(canvas) {
    gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        powerPreference: 'low-power'
    });
    if (!gl) return false;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return false;
    }

    gl.useProgram(program);

    // Buffer holding a full screen quad
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1,
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    timeLocation = gl.getUniformLocation(program, 'u_time');
    color1Location = gl.getUniformLocation(program, 'u_color1');
    color2Location = gl.getUniformLocation(program, 'u_color2');
    color3Location = gl.getUniformLocation(program, 'u_color3');
    resolutionLocation = gl.getUniformLocation(program, 'u_resolution');

    return true;
}

let startTime = performance.now();

function render(time) {
    if (!gl) return;

    // Smooth color interpolation
    const lerpFactor = 0.05;
    for (let i = 0; i < 3; i++) {
        currentColor1[i] = lerp(currentColor1[i], targetColor1[i], lerpFactor);
        currentColor2[i] = lerp(currentColor2[i], targetColor2[i], lerpFactor);
        currentColor3[i] = lerp(currentColor3[i], targetColor3[i], lerpFactor);
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(timeLocation, (time - startTime) * 0.001);
    gl.uniform3fv(color1Location, currentColor1);
    gl.uniform3fv(color2Location, currentColor2);
    gl.uniform3fv(color3Location, currentColor3);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    animationFrameId = requestAnimationFrame(render);
}

self.onmessage = function (e) {
    if (e.data.type === 'init') {
        const { canvas, width, height } = e.data;
        canvas.width = width;
        canvas.height = height;
        if (initWebGL(canvas)) {
            render(performance.now());
        }
    } else if (e.data.type === 'resize') {
        if (gl) {
            gl.canvas.width = e.data.width;
            gl.canvas.height = e.data.height;
        }
    } else if (e.data.type === 'updateColors') {
        const { colors } = e.data;
        if (colors?.dominant) targetColor1 = hexToRgb(colors.dominant);
        if (colors?.secondary) targetColor2 = hexToRgb(colors.secondary);
        if (colors?.tertiary) targetColor3 = hexToRgb(colors.tertiary);
    } else if (e.data.type === 'stop') {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        if (gl) {
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
    }
};
