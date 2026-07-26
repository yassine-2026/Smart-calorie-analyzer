const express = require('express');
const multer = require('multer');
const { Groq } = require('groq-sdk');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('يرجى رفع صورة صالحة.'));
        }
    }
});

let groqClient = null;
function getGroqClient() {
    if (!groqClient && process.env.GROQ_API_KEY) {
        groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groqClient;
}

app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
        const groq = getGroqClient();
        if (!groq) {
            return res.status(500).json({ error: 'لم يتم إعداد مفتاح الذكاء الاصطناعي' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'الرجاء التقاط أو رفع صورة صالحة.' });
        }

        const base64Image = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;

        const prompt = `قم بتحليل صورة الطعام هذه بدقة.
استخرج المعلومات التالية بتنسيق JSON حصراً. لا تكتب أي نص إضافي قبل أو بعد كائن JSON.
{
    "name": "اسم الطعام باللغة العربية",
    "ingredients": "المكونات المحتملة (نص)",
    "weight": 0, // الوزن التقريبي بالجرام كـ رقم صحيح
    "calories": 0, // السعرات الحرارية كـ رقم صحيح
    "protein": 0, // البروتين بالجرام كـ رقم صحيح
    "fat": 0, // الدهون بالجرام كـ رقم صحيح
    "carbs": 0, // الكربوهيدرات بالجرام كـ رقم صحيح
    "confidence": 0, // نسبة ثقتك في التحليل (0-100) كـ رقم صحيح
    "tips": "نصائح غذائية مفيدة (نص)"
}
إذا لم تكن الصورة لطعام واضح، أعد القيم بأصفار وضع رسالة في tips تطلب رفع صورة أوضح لطعام.`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                    ]
                }
            ],
            model: process.env.GROQ_MODEL || 'llama-3.2-11b-vision-preview',
            temperature: 0.1,
        });

        let content = completion.choices[0]?.message?.content || "";
        
        // Clean markdown JSON formatting if present
        content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

        // Extract JSON substring if there's any extra text
        const jsonStartIndex = content.indexOf('{');
        const jsonEndIndex = content.lastIndexOf('}');
        
        if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            content = content.substring(jsonStartIndex, jsonEndIndex + 1);
        }

        let data;
        try {
            data = JSON.parse(content);
        } catch (parseError) {
            console.error("Failed to parse JSON:", content);
            throw new Error("يرجى رفع صورة أوضح");
        }

        res.json(data);

    } catch (error) {
        console.error('API Error:', error.message);
        
        let errorMessage = 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.';
        
        if (error.status === 429 || (error.message && error.message.toLowerCase().includes('rate limit')) || (error.message && error.message.toLowerCase().includes('quota'))) {
            errorMessage = 'عذراً، لقد تجاوزت الحد المسموح للاستخدام. يرجى المحاولة لاحقاً.';
        } else if (error.message && error.message.toLowerCase().includes('model')) {
            // Model not found or decommissioned - display generic error, log the real one
            console.error('Model Error:', error.message);
            errorMessage = 'حدث خطأ في النظام. يرجى المحاولة لاحقاً.';
        } else if (error.status === 404) {
            console.error('Not Found Error (might be model):', error.message);
            errorMessage = 'حدث خطأ في النظام. يرجى المحاولة لاحقاً.';
        } else if (error.message && error.message.includes('صورة أوضح')) {
            errorMessage = 'تعذر تحليل الصورة بدقة. يرجى رفع صورة أوضح.';
        } else if (error.message && error.message.includes('صورة صالحة')) {
            errorMessage = 'يرجى رفع صورة صالحة.';
        } else if (error.status === 401) {
            errorMessage = 'مفتاح API غير صالح. يرجى التحقق من إعدادات المفتاح.';
        } else if (error.status === 400 || error.status >= 500) {
            errorMessage = 'تعذر تحليل الصورة بدقة. يرجى رفع صورة أوضح.'; // Fallback for general vision errors
        }

        res.status(500).json({ error: errorMessage });
    }
});

// Error handling middleware for multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'حجم الصورة كبير جداً. الحد الأقصى هو 10 ميغابايت.' });
        }
    }
    if (err) {
        return res.status(500).json({ error: 'حدث خطأ أثناء معالجة الملف.' });
    }
    next();
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
