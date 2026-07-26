document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const dropZone = document.getElementById('dropZone');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const btnRemoveImage = document.getElementById('btnRemoveImage');
    
    const fileInput = document.getElementById('fileInput');
    const cameraInput = document.getElementById('cameraInput');
    const btnCamera = document.getElementById('btnCamera');
    const btnUpload = document.getElementById('btnUpload');
    
    const btnAnalyze = document.getElementById('btnAnalyze');
    
    // States Containers
    const actionState = document.getElementById('actionState');
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const resultState = document.getElementById('resultsContainer');
    
    const loadingTitle = document.getElementById('loadingTitle');
    const loadingProgress = document.getElementById('loadingProgress');
    const errorMessage = document.getElementById('errorMessage');
    const btnRetry = document.getElementById('btnRetry');

    let currentFile = null;
    let loadInterval = null;

    // --- Utility: Smooth State Switching ---
    function switchState(showId, hideIds) {
        hideIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('fade-enter-active');
            }
        });
        
        const showEl = document.getElementById(showId);
        if (showEl) {
            showEl.classList.remove('hidden');
            // Allow display block to apply before animating opacity
            requestAnimationFrame(() => {
                showEl.classList.add('fade-enter-active');
            });
        }
    }

    // --- Inputs Handling ---
    btnUpload.addEventListener('click', () => fileInput.click());
    btnCamera.addEventListener('click', () => cameraInput.click());
    
    dropZone.addEventListener('click', (e) => {
        // Prevent click if clicking remove button
        if (e.target.closest('#btnRemoveImage')) return;
        if (!currentFile) fileInput.click();
    });

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!currentFile) {
            dropZone.classList.add('border-[#34C759]', 'bg-[#F2F2F7]');
        }
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-[#34C759]', 'bg-[#F2F2F7]');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-[#34C759]', 'bg-[#F2F2F7]');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) processFile(e.target.files[0]);
    });
    
    cameraInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) processFile(e.target.files[0]);
    });

    btnRemoveImage.addEventListener('click', (e) => {
        e.stopPropagation();
        resetUpload();
    });

    btnRetry.addEventListener('click', () => {
        if (currentFile) {
            switchState('actionState', ['loadingState', 'errorState', 'resultsContainer']);
            btnAnalyze.disabled = false;
        } else {
            resetUpload();
        }
    });

    // --- File Processing & Preview ---
    function processFile(file) {
        if (!file.type.startsWith('image/')) {
            showError('الرجاء اختيار ملف صورة صالح.');
            return;
        }

        // Show Preview
        const objectUrl = URL.createObjectURL(file);
        imagePreview.src = objectUrl;
        
        uploadPlaceholder.classList.add('hidden');
        previewContainer.classList.remove('hidden');
        
        // Reset states
        switchState('actionState', ['loadingState', 'errorState', 'resultsContainer']);
        btnAnalyze.disabled = true;
        
        // Compress
        compressImage(file, (compressedFile) => {
            currentFile = compressedFile;
            btnAnalyze.disabled = false;
        });
    }

    function resetUpload() {
        currentFile = null;
        imagePreview.src = '';
        fileInput.value = '';
        cameraInput.value = '';
        
        previewContainer.classList.add('hidden');
        uploadPlaceholder.classList.remove('hidden');
        
        switchState('actionState', ['loadingState', 'errorState', 'resultsContainer']);
        btnAnalyze.disabled = true;
    }

    // Fast HTML5 Canvas Compression
    function compressImage(file, callback) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 1000;
                let width = img.width;
                let height = img.height;

                if (width > height && width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(blob => {
                    callback(new File([blob], file.name || 'image.jpg', {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    }));
                }, 'image/jpeg', 0.85);
            };
        };
    }

    // --- API & Loading Animation ---
    btnAnalyze.addEventListener('click', async () => {
        if (!currentFile) return;

        startLoadingAnimation();
        
        const formData = new FormData();
        formData.append('image', currentFile);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            stopLoadingAnimation(true);

            if (!response.ok) {
                throw new Error(data.error || 'فشل الاتصال بالخادم.');
            }

            // Small delay for smooth UI transition
            setTimeout(() => {
                renderResults(data);
            }, 300);

        } catch (error) {
            stopLoadingAnimation(false);
            showError(error.message);
        }
    });

    const loadMessages = [
        "جاري التعرف على الطعام...",
        "تحليل المكونات والعناصر...",
        "حساب السعرات الحرارية...",
        "تجهيز النتائج النهائية..."
    ];

    function startLoadingAnimation() {
        btnAnalyze.disabled = true;
        btnRemoveImage.classList.add('hidden');
        switchState('loadingState', ['actionState', 'errorState', 'resultsContainer']);
        
        let msgIdx = 0;
        loadingTitle.textContent = loadMessages[msgIdx];
        loadingTitle.style.opacity = '1';
        loadingProgress.style.width = '10%';
        
        loadInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % loadMessages.length;
            
            // Fade out
            loadingTitle.style.opacity = '0';
            
            setTimeout(() => {
                loadingTitle.textContent = loadMessages[msgIdx];
                // Fade in
                loadingTitle.style.opacity = '1';
            }, 300);
            
            // Progress Bar simulation
            const currentW = parseInt(loadingProgress.style.width) || 10;
            if (currentW < 90) loadingProgress.style.width = (currentW + 15) + '%';
            
        }, 1800);
    }

    function stopLoadingAnimation(success) {
        clearInterval(loadInterval);
        loadingTitle.style.opacity = '1';
        if (success) {
            loadingProgress.style.width = '100%';
        }
        btnRemoveImage.classList.remove('hidden');
        btnAnalyze.disabled = false;
    }

    // --- Results Display ---
    function renderResults(data) {
        const safe = {
            name: data.name || 'غير معروف',
            ingredients: data.ingredients || 'غير متوفرة',
            weight: typeof data.weight === 'number' ? data.weight : 0,
            calories: typeof data.calories === 'number' ? data.calories : 0,
            protein: typeof data.protein === 'number' ? data.protein : 0,
            fat: typeof data.fat === 'number' ? data.fat : 0,
            carbs: typeof data.carbs === 'number' ? data.carbs : 0,
            confidence: typeof data.confidence === 'number' ? data.confidence : 0,
            tips: data.tips || 'لا توجد نصائح متوفرة.'
        };

        document.getElementById('foodName').textContent = safe.name;
        document.getElementById('valWeight').textContent = safe.weight;
        document.getElementById('valConfidence').textContent = safe.confidence;
        document.getElementById('valIngredients').textContent = safe.ingredients;
        document.getElementById('valTips').textContent = safe.tips;

        // Animate Numbers
        animateNumber('valCalories', 0, safe.calories, 1200);
        animateNumber('valProtein', 0, safe.protein, 1000);
        animateNumber('valFat', 0, safe.fat, 1000);
        animateNumber('valCarbs', 0, safe.carbs, 1000);

        switchState('resultsContainer', ['actionState', 'loadingState', 'errorState']);
        
        // Scroll slightly on mobile
        if (window.innerWidth < 1024) {
            document.getElementById('resultsContainer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // Ease-out Number Animation
    function animateNumber(id, start, end, duration) {
        const obj = document.getElementById(id);
        if (!obj) return;
        if (start === end) {
            obj.textContent = end;
            return;
        }
        let startTime = null;
        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            // Cubic ease-out
            const ease = 1 - Math.pow(1 - progress, 3);
            obj.textContent = Math.floor(ease * (end - start) + start);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.textContent = end;
            }
        };
        window.requestAnimationFrame(step);
    }

    // --- Error Handling ---
    function showError(msg) {
        errorMessage.textContent = msg;
        switchState('errorState', ['actionState', 'loadingState', 'resultsContainer']);
    }
});
