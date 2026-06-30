use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc, RwLock,
};
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct ProxyNode {
    pub url: String,
}

pub struct ProxyClientGuard {
    pub node_id: usize,
}

impl Drop for ProxyClientGuard {
    fn drop(&mut self) {
        // Espacio reservado para lógica de métricas o cooldowns al liberar el nodo
    }
}

pub struct ProxyRotator {
    pub nodes: Arc<RwLock<Vec<ProxyNode>>>,
    next_index: AtomicUsize,
}

impl ProxyRotator {
    pub fn new(urls: Vec<String>) -> Result<Self, Box<dyn std::error::Error>> {
        if urls.is_empty() {
            return Err("ProxyRotator requiere al menos una URL".into());
        }

        let nodes = urls
            .into_iter()
            .map(|url| ProxyNode { url })
            .collect();

        Ok(Self {
            nodes: Arc::new(RwLock::new(nodes)),
            next_index: AtomicUsize::new(0),
        })
    }

    pub fn get_client(&self) -> ProxyClientGuard {
        let len = match self.nodes.read() {
            Ok(guard) => guard.len(),
            Err(poisoned) => poisoned.into_inner().len(),
        };

        let idx = self.next_index.fetch_add(1, Ordering::Relaxed) % len;

        ProxyClientGuard { node_id: idx }
    }

    /// Devuelve la siguiente URL de proxy en round-robin (o "direct")
    pub fn next_proxy_url(&self) -> String {
        let nodes = match self.nodes.read() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        let idx = self.next_index.fetch_add(1, Ordering::Relaxed) % nodes.len();
        nodes[idx].url.clone()
    }

    /// Construye un reqwest::Client con el siguiente proxy del pool
    pub fn build_proxied_client(&self, timeout: Duration) -> reqwest::Client {
        let url = self.next_proxy_url();
        let mut builder = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .timeout(timeout);

        if url != "direct" {
            if let Ok(proxy) = reqwest::Proxy::all(&url) {
                builder = builder.proxy(proxy);
            }
        }

        builder.build().unwrap_or_else(|_| reqwest::Client::new())
    }
}
