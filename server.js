const express = require('express');
const multer = require('multer');
const { Groq } = require('groq-sdk');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Configure Multer for temporary memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('الملف الذي تم رفعه ليس صورة.'));
        }
    }
});

// Lazy initialization of Groq Client
let groqClient = null;
function getGroqClient() {
    if (!groqClient) {
        if (!process.env.GROQ_API_KEY) return null;
        groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groqClient;
}

// Analysis API Endpoint
app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
        const groq = getGroqClient();
        if (!groq) {
            return res.status(500).json({ error: 'مفتاح GROQ_API_KEY غير متوفر في متغيرات البيئة.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'الرجاء التقاط أو رفع صورة صالحة.' });
        }

        const base64Image = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;

        const prompt = `قم بتحليل صورة الطعام هذه. استخرج المعلومات التالية بتنسيق JSON حصراً:
{
    "name": "اسم الطعام (بالعربية)",
    "weight": "الوزن التقريبي (رقم فقط بالجرام)",
    "calories": "عدد السعرات الحرارية (رقم فقط)",
    "protein": "البروتين (رقم فقط بالجرام)",
    "fat": "الدهون (رقم فقط بالجرام)",
    "carbs": "الكربوهيدرات (رقم فقط بالجرام)",
    "confidence": "نسبة ثقتك في التحليل (رقم فقط من 100)",
    "tips": "نصيحة غذائية قصيرة"
}
تأكد أن المفاتيح باللغة الإنجليزية كما هي، وأن القيم المخصصة للأرقام تحتوي على أرقام فقط بدون نصوص، باستثناء name و tips.
لا تكتب أي نص آخر خارج كائن JSON.`;

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
            // Using a powerful current Groq vision model
            model: 'llama-3.2-90b-vision-preview',
            temperature: 0.1,
        });

        const content = completion.choices[0]?.message?.content || "";
        
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            res.json(data);
        } else {
            throw new Error("لم يتمكن النموذج من التعرف على الطعام وتوليد استجابة JSON صحيحة.");
        }

    } catch (error) {
        console.error('Error during image analysis:', error);
        
        // Handle specific API or App errors
        if (error.status === 429 || (error.response && error.response.status === 429)) {
            return res.status(429).json({ error: 'عذراً، تم استنفاد الحصة المسموحة من طلبات Groq API. يرجى المحاولة لاحقاً.' });
        }
        
        if (error.message.includes('ليس صورة')) {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'حدث خطأ أثناء الاتصال بالخادم أو تحليل الصورة. تأكد من أن الصورة واضحة.' });
    }
});

// Fallback route to serve the frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
