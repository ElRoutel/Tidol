#include "whisper.h"
#include <iostream>
#include <string>
#include <vector>
#include <cstring>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <cstdlib>

// =========================================================================
// [SECCIÓN 1]: CONTEXTO GLOBAL Y PARSER BINARIO RIFF/WAV
// =========================================================================
struct whisper_context * g_ctx = nullptr;

bool safe_read_wav(const std::string & fname, std::vector<float> & pcmf32) {
    std::ifstream fin(fname, std::ios::binary);
    if (!fin) {
        std::cerr << "[AI-Plugin] Error crítico: Imposible abrir el archivo binario: " << fname << std::endl;
        return false;
    }

    char chunk_id[4];
    char format[4];
    uint32_t chunk_size = 0;

    fin.read(chunk_id, 4);
    fin.read(reinterpret_cast<char*>(&chunk_size), 4);
    fin.read(format, 4);

    if (std::memcmp(chunk_id, "RIFF", 4) != 0 || std::memcmp(format, "WAVE", 4) != 0) {
        std::cerr << "[AI-Plugin] Error de formato: Estructura RIFF/WAVE inválida." << std::endl;
        return false;
    }

    bool fmt_verified = false;
    uint32_t data_offset = 0;
    uint32_t data_size = 0;

    while (fin.read(chunk_id, 4)) {
        fin.read(reinterpret_cast<char*>(&chunk_size), 4);

        if (std::memcmp(chunk_id, "fmt ", 4) == 0) {
            uint16_t audio_format = 0;
            uint16_t channels = 0;
            uint32_t sample_rate = 0;
            uint16_t bits_per_sample = 0;

            fin.read(reinterpret_cast<char*>(&audio_format), 2);
            fin.read(reinterpret_cast<char*>(&channels), 2);
            fin.read(reinterpret_cast<char*>(&sample_rate), 4);
            fin.seekg(6, std::ios::cur);
            fin.read(reinterpret_cast<char*>(&bits_per_sample), 2);

            if (audio_format != 1 || channels != 1 || sample_rate != 16000 || bits_per_sample != 16) {
                std::cerr << "[AI-Plugin] Error: Audio debe ser PCM Estricto 16kHz, Mono, 16-bit." << std::endl;
                return false;
            }

            fmt_verified = true;
            if (chunk_size > 16) fin.seekg(chunk_size - 16, std::ios::cur);
        }
        else if (std::memcmp(chunk_id, "data", 4) == 0) {
            data_size = chunk_size;
            data_offset = static_cast<uint32_t>(fin.tellg());
            break;
        }
        else {
            fin.seekg(chunk_size, std::ios::cur);
        }
    }

    if (!fmt_verified || data_offset == 0) {
        std::cerr << "[AI-Plugin] Error estructural: falta 'fmt ' o 'data'." << std::endl;
        return false;
    }

    fin.seekg(data_offset, std::ios::beg);
    size_t sample_count = data_size / sizeof(int16_t);
    std::vector<int16_t> samples(sample_count);
    fin.read(reinterpret_cast<char*>(samples.data()), data_size);

    if (!fin) {
        std::cerr << "[AI-Plugin] Error: no se pudieron leer las muestras PCM." << std::endl;
        return false;
    }

    pcmf32.resize(sample_count);
    for (size_t i = 0; i < sample_count; ++i) {
        pcmf32[i] = static_cast<float>(samples[i]) / 32768.0f;
    }
    return true;
}

// =========================================================================
// [SECCIÓN 2]: SANITIZACIÓN Y FORMATEO DE TIMESTAMPS
// =========================================================================
std::string escape_json_string(const std::string & input) {
    std::ostringstream ss;
    for (char c : input) {
        switch (c) {
            case '\\': ss << "\\\\"; break;
            case '"':  ss << "\\\""; break;
            case '\n': ss << "\\n"; break;
            case '\r': ss << "\\r"; break;
            case '\t': ss << "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 32) {
                    ss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(static_cast<unsigned char>(c));
                } else {
                    ss << c;
                }
        }
    }
    return ss.str();
}

std::string format_lrc_timestamp(int64_t t_cs) {
    int64_t min = t_cs / 6000;
    int64_t sec = (t_cs - min * 6000) / 100;
    int64_t frac = t_cs % 100;

    std::ostringstream oss;
    oss << "[" << std::setfill('0') << std::setw(2) << min << ":"
        << std::setfill('0') << std::setw(2) << sec << "."
        << std::setfill('0') << std::setw(2) << frac << "]";
    return oss.str();
}

std::string clean_token_text(const std::string& raw_token) {
    std::string out;
    out.reserve(raw_token.size());

    for (size_t i = 0; i < raw_token.size(); ++i) {
        const unsigned char c = static_cast<unsigned char>(raw_token[i]);

        if (c == 0xE2 && i + 2 < raw_token.size() &&
            static_cast<unsigned char>(raw_token[i + 1]) == 0x96 &&
            static_cast<unsigned char>(raw_token[i + 2]) == 0x81) {
            out += ' ';
            i += 2;
            continue;
        }

        out += raw_token[i];
    }

    if (out.rfind("<|", 0) == 0 && out.find("|>") != std::string::npos) {
        return "";
    }

    size_t start = out.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";

    size_t end = out.find_last_not_of(" \t\r\n");
    return out.substr(start, end - start + 1);
}

// =========================================================================
// [SECCIÓN 3]: INTERFAZ FFI DE EXPORTACIÓN (CONTRATO DE ENTRADA/SALIDA)
// =========================================================================
extern "C" {

    __attribute__((visibility("default")))
    char* get_provider_name() {
        const std::string msg = "Whisper.cpp CUDA Core Engine (Thread-Isolated)";
        char* res = (char*)malloc(msg.size() + 1);
        if (res) std::strcpy(res, msg.c_str());
        return res;
    }

    __attribute__((visibility("default")))
    char* init_ai_model(const char* model_path) {
        if (!model_path) {
            std::string err = "{\"status\":\"error\",\"message\":\"Puntero model_path nulo\"}";
            char* res = (char*)malloc(err.length() + 1);
            if (res) std::strcpy(res, err.c_str());
            return res;
        }

        if (g_ctx != nullptr) {
            std::string msg = "{\"status\":\"success\",\"message\":\"Modelo previamente alojado en VRAM\"}";
            char* res = (char*)malloc(msg.length() + 1);
            if (res) std::strcpy(res, msg.c_str());
            return res;
        }

        struct whisper_context_params cparams = whisper_context_default_params();
        cparams.use_gpu = true;

        g_ctx = whisper_init_from_file_with_params(model_path, cparams);

        if (g_ctx == nullptr) {
            std::string err = "{\"status\":\"error\",\"message\":\"Fallo severo al instanciar el contexto CUDA\"}";
            char* res = (char*)malloc(err.length() + 1);
            if (res) std::strcpy(res, err.c_str());
            return res;
        }

        std::string msg = "{\"status\":\"success\",\"message\":\"Pesos de red neuronal inyectados en VRAM con éxito\"}";
        char* res = (char*)malloc(msg.length() + 1);
        if (res) std::strcpy(res, msg.c_str());
        return res;
    }

    __attribute__((visibility("default")))
    char* run_whisper_pipeline(const char* wav_file_path, int mode, const char* reference_text) {
        if (!wav_file_path || g_ctx == nullptr) {
            std::string err = "{\"status\":\"error\",\"message\":\"Parámetros FFI inválidos\"}";
            char* res = (char*)malloc(err.length() + 1);
            if (res) std::strcpy(res, err.c_str());
            return res;
        }

        std::vector<float> pcmf32;
        if (!safe_read_wav(wav_file_path, pcmf32)) {
            std::string err = "{\"status\":\"error\",\"message\":\"Error estructural al decodificar WAV\"}";
            char* res = (char*)malloc(err.length() + 1);
            if (res) std::strcpy(res, err.c_str());
            return res;
        }

        struct whisper_state * g_state = whisper_init_state(g_ctx);
        if (g_state == nullptr) {
            std::string err = "{\"status\":\"error\",\"message\":\"Incapacidad de segmentar memoria para g_state\"}";
            char* res = (char*)malloc(err.length() + 1);
            if (res) std::strcpy(res, err.c_str());
            return res;
        }

        struct whisper_full_params wparams = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
        wparams.print_progress   = false;
        wparams.print_timestamps = false;
        wparams.print_special    = false;
        wparams.translate        = false;
        wparams.language         = "es";
        wparams.n_threads        = 4;
        wparams.no_context       = true;
        wparams.token_timestamps = true;
        wparams.suppress_nst     = true; // Suppress non-speech tokens like [Aplausos]
        wparams.suppress_blank   = true;

        if (mode == 1 && reference_text != nullptr) {
            wparams.initial_prompt = reference_text;
        }

        if (whisper_full_with_state(g_ctx, g_state, wparams, pcmf32.data(), pcmf32.size()) != 0) {
            whisper_free_state(g_state);
            std::string err = "{\"status\":\"error\",\"message\":\"Fallo durante el cálculo de tensores en CUDA\"}";
            char* res = (char*)malloc(err.length() + 1);
            if (res) std::strcpy(res, err.c_str());
            return res;
        }

        std::ostringstream words_json;
        std::ostringstream lrc_text;
        words_json << "[";
        bool first_word = true;

        const int n_segments = whisper_full_n_segments_from_state(g_state);
        
        std::string current_word = "";
        int64_t current_start = -1;
        int64_t current_end = -1;

        auto flush_word = [&]() {
            if (!current_word.empty()) {
                if (!first_word) words_json << ",";
                words_json << "{"
                           << "\"word\":\"" << escape_json_string(current_word) << "\","
                           << "\"start_cs\":" << current_start << ","
                           << "\"end_cs\":" << current_end
                           << "}";
                first_word = false;
                current_word = "";
            }
        };

        for (int i = 0; i < n_segments; ++i) {
            const char* segment_text = whisper_full_get_segment_text_from_state(g_state, i);
            int64_t seg_t0 = whisper_full_get_segment_t0_from_state(g_state, i);

            if (segment_text != nullptr) {
                lrc_text << format_lrc_timestamp(seg_t0) << " " << segment_text << "\n";
            }

            const int n_tokens = whisper_full_n_tokens_from_state(g_state, i);
            for (int j = 0; j < n_tokens; ++j) {
                whisper_token_data token = whisper_full_get_token_data_from_state(g_state, i, j);
                const char* raw_token_text = whisper_full_get_token_text_from_state(g_ctx, g_state, i, j);
                if (!raw_token_text) continue;

                std::string raw_str = raw_token_text;
                bool starts_with_space = false;
                if (!raw_str.empty() && raw_str[0] == ' ') starts_with_space = true;
                if (raw_str.size() >= 3 && (unsigned char)raw_str[0] == 0xE2 && (unsigned char)raw_str[1] == 0x96 && (unsigned char)raw_str[2] == 0x81) {
                    starts_with_space = true;
                }

                std::string clean_word = clean_token_text(raw_token_text);
                if (clean_word.empty()) continue;
                if (token.t1 < token.t0) continue;

                if (starts_with_space && !current_word.empty()) {
                    flush_word();
                }

                if (current_word.empty()) {
                    current_word = clean_word;
                    current_start = token.t0;
                    current_end = token.t1;
                } else {
                    current_word += clean_word;
                    current_end = token.t1;
                }
            }
        }
        flush_word();
        words_json << "]";

        whisper_free_state(g_state);

        std::ostringstream final_response;
        final_response << "{"
                       << "\"status\":\"success\","
                       << "\"words\":" << words_json.str() << ","
                       << "\"lrc\":\"" << escape_json_string(lrc_text.str()) << "\""
                       << "}";

        std::string json_str = final_response.str();
        char* res = (char*)malloc(json_str.length() + 1);
        if (res) std::strcpy(res, json_str.c_str());
        return res;
    }

    __attribute__((visibility("default")))
    void free_plugin_string(char* s) {
        if (s != nullptr) free(s);
    }

    __attribute__((visibility("default")))
    void shutdown_ai_model() {
        if (g_ctx != nullptr) {
            whisper_free(g_ctx);
            g_ctx = nullptr;
        }
    }
}
