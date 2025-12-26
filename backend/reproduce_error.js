import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import axios from "axios";
import db from "./models/db.js";

async function run() {
    try {
        console.log("🔑 Getting user...");
        const user = await db.get("SELECT * FROM usuarios LIMIT 1");
        if (!user) {
            console.error("❌ No users found");
            return;
        }
        console.log("👤 User found:", user.id, user.nombre);

        if (!process.env.JWT_SECRET) {
            console.error("❌ JWT_SECRET not found in env");
            return;
        }

        // Force ID 1 for testing (assuming admin/normal user exists with ID 1)
        const testUserId = 1;
        console.log("🧪 Testing with User ID:", testUserId);

        const token = jwt.sign({ id: testUserId, role: 'user' }, process.env.JWT_SECRET);

        console.log("🚀 Sending request to /api/music/songs/likes...");
        try {
            const res = await axios.get("http://localhost:3000/api/music/songs/likes", {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("✅ Success!", res.status);
            console.log("📦 Data length:", res.data.length);
        } catch (reqErr) {
            if (reqErr.response) {
                console.error("❌ Request Failed:", reqErr.response.status, reqErr.response.statusText);
                console.error("📄 Response Data:", JSON.stringify(reqErr.response.data, null, 2));
            } else {
                console.error("❌ Request Error:", reqErr.message);
            }
        }

    } catch (err) {
        console.error("❌ Script Error:", err);
    }
}

run();
