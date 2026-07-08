// -------------------------------------------------------------------------
// CARGADOR DINÁMICO FFI: LETRAS (legal — scraping de letras públicas)
// -------------------------------------------------------------------------
pub struct DynamicLyricsProvider {
    pub name: String,
    fetch_lyrics_fn: unsafe extern "C" fn(
        *const std::ffi::c_char,
        *const std::ffi::c_char,
    ) -> *mut std::ffi::c_char,
    free_string_fn: unsafe extern "C" fn(*mut std::ffi::c_char),
    _lib: libloading::Library,
}

impl DynamicLyricsProvider {
    pub fn new(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        unsafe {
            let lib = libloading::Library::new(path)?;
            let name_fn: libloading::Symbol<unsafe extern "C" fn() -> *mut std::ffi::c_char> =
                lib.get(b"get_provider_name")?;
            let free_string_fn: unsafe extern "C" fn(*mut std::ffi::c_char) =
                *lib.get(b"free_plugin_string")?;

            let name_ptr = name_fn();
            if name_ptr.is_null() {
                return Err("Null pointer from plugin".into());
            }

            let name = std::ffi::CStr::from_ptr(name_ptr)
                .to_string_lossy()
                .into_owned();
            free_string_fn(name_ptr);

            let fetch_lyrics_fn = *lib.get(b"fetch_lyrics")?;

            Ok(Self {
                name,
                fetch_lyrics_fn,
                free_string_fn,
                _lib: lib,
            })
        }
    }

    pub fn fetch_lyrics(&self, track_name: &str, artist_name: &str) -> String {
        unsafe {
            let c_track = std::ffi::CString::new(track_name).unwrap_or_default();
            let c_artist = std::ffi::CString::new(artist_name).unwrap_or_default();
            let res_ptr = (self.fetch_lyrics_fn)(c_track.as_ptr(), c_artist.as_ptr());

            if res_ptr.is_null() {
                return r#"{"status":"error"}"#.to_string();
            }

            let res = std::ffi::CStr::from_ptr(res_ptr)
                .to_string_lossy()
                .into_owned();
            (self.free_string_fn)(res_ptr);
            res
        }
    }
}
