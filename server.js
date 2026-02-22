import express from "express";
import multer from "multer";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Create uploads folder if not exists
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

// Multer setup
const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

app.post("/check-image", upload.single("file"), async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const imagePath = req.file.path;
        const mimeType = req.file.mimetype;

        // Read image as base64
        const base64Image = fs.readFileSync(imagePath, {
            encoding: "base64",
        });

        // Call OpenAI Vision
        const response = await openai.responses.create({
            model: "gpt-4.1-mini",
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: `
Analyze this prescription.

Identify the disease in simple everyday language.

If not a prescription, reply NO.

Return only the disease name in simple terms.
`
                        },
                        {
                            type: "input_image",
                            image_url: `data:${mimeType};base64,${base64Image}`
                        }
                    ]
                }
            ]
        });

        // Extract text safely
        let result = "NO";

        if (response.output && response.output.length > 0) {
            const content = response.output[0].content;
            if (content && content.length > 0 && content[0].text) {
                result = content[0].text.trim().toUpperCase();
            }
        }

        // Delete uploaded image
        fs.unlinkSync(imagePath);

        res.json({ result });

    } catch (error) {
        console.error("Error:", error);

        // Delete image if exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ error: "Something went wrong" });
    }
});

app.post("/check-disease-match", upload.single("file"), async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const { disease } = req.body;

        if (!disease) {
            return res.status(400).json({ error: "Disease is required" });
        }

        const imagePath = req.file.path;
        const mimeType = req.file.mimetype;

        const base64Image = fs.readFileSync(imagePath, {
            encoding: "base64",
        });

        const response = await openai.responses.create({
            model: "gpt-4.1-mini",
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: `
A user claims this image is related to: ${disease}

Analyze the image carefully.

Determine if the image is actually related 
to the disease "${disease}".

If clearly related, reply ONLY:
YES

If not related, reply ONLY:
NO

Do not explain.
`
                        },
                        {
                            type: "input_image",
                            image_url: `data:${mimeType};base64,${base64Image}`
                        }
                    ]
                }
            ]
        });

        // Extract text safely
        let result = "NO";

        if (response.output && response.output.length > 0) {
            const content = response.output[0].content;
            if (content && content.length > 0 && content[0].text) {
                result = content[0].text.trim().toUpperCase();
            }
        }

        // Delete uploaded image
        fs.unlinkSync(imagePath);

        res.json({ result });
    } catch (error) {
        console.error("Error:", error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ error: "Something went wrong" });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});