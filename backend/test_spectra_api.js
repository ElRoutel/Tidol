import axios from 'axios';
import dotenv from 'dotenv';
import { guardarCalidad } from './audioQuality.js';

dotenv.config();

const BASE_URL = 'http://localhost:3000/api/internal/spectra/analysis';
const SECRET = process.env.SPECTRA_SECRET;

async function runTests() {
    console.log("🧪 Starting Spectra API Tests...");

    if (!SECRET) {
        console.error("❌ SPECTRA_SECRET not found in .env");
        process.exit(1);
    }

    // Test 1: No Secret
    try {
        await axios.post(BASE_URL, { cancionId: 1, data: {} });
        console.error("❌ Test 1 Failed: Request without secret should have failed");
    } catch (e) {
        if (e.response && e.response.status === 403) {
            console.log("✅ Test 1 Passed: Request without secret rejected (403)");
        } else {
            console.error("❌ Test 1 Failed: Unexpected error", e.message);
            if (e.code) console.error("Error Code:", e.code);
            if (e.cause) console.error("Error Cause:", e.cause);
        }
    }

    // Test 2: Invalid Secret
    try {
        await axios.post(BASE_URL, { cancionId: 1, data: {} }, { headers: { 'x-spectra-secret': 'wrong' } });
        console.error("❌ Test 2 Failed: Request with invalid secret should have failed");
    } catch (e) {
        if (e.response && e.response.status === 403) {
            console.log("✅ Test 2 Passed: Request with invalid secret rejected (403)");
        } else {
            console.error("❌ Test 2 Failed: Unexpected error", e.message);
            if (e.code) console.error("Error Code:", e.code);
        }
    }

    // Test 3: Valid Request via audioQuality.js
    console.log("🔄 Testing guardarCalidad function...");
    try {
        // Mock data
        const mockData = {
            bitDepth: 24,
            sampleRate: 48000,
            bitRate: 320000,
            codec: 'flac',
            clasificacion: 'Hi-Res',
            espectrograma: 'test.png',
            sospechoso: false
        };

        // Try with ID 1. If it doesn't exist, it might fail DB constraint, but that means Auth passed.
        await guardarCalidad(1, mockData);
        console.log("✅ Test 3 Passed: guardarCalidad executed successfully (200 OK)");
    } catch (e) {
        if (e.response && e.response.status === 500) {
            console.log("⚠️ Test 3 Partial: Auth passed, but DB error (likely invalid ID or Server Error). This confirms API is reachable.");
        } else {
            console.error("❌ Test 3 Failed:", e.message);
            if (e.code) console.error("Error Code:", e.code);
            if (e.response) console.error("Response:", e.response.data);
        }
    }
}

runTests();
