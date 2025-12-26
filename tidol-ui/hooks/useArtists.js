import { useState, useEffect, useRef } from "react";
import api from "../api/axiosConfig";

export default function useArtists() {
    const [artists, setArtists] = useState([]);
    const [loading, setLoading] = useState(false);
    const fetched = useRef(false);

    const load = async () => {
        if (fetched.current) return;
        try {
            setLoading(true);
            const r = await api.get("/artists");
            setArtists(r.data || []);
            fetched.current = true;
        } catch (e) {
            console.error("get artists error", e);
        } finally { setLoading(false); }
    };

    return { artists, setArtists, loading, load };
}
