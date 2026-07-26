document.addEventListener('DOMContentLoaded', () => {
    const btnCamera = document.getElementById('btnCamera');
    const btnUpload = document.getElementById('btnUpload');
    const cameraInput = document.getElementById('cameraInput');
    const uploadInput = document.getElementById('uploadInput');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const btnAnalyze = document.getElementById('btnAnalyze');
    
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    const resultsContainer = document.getElementById('resultsContainer');

    let currentFile = null;

    // Trigger file inputs
    btnCamera.addEventListener('click', () => cameraInput.click());
    btnUpload.addEventListener('click', () => uploadInput.click());

    const handleFileSelection = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showError('الرجاء اختيار ملف صورة صالح.');
            return;
        }

        currentFile = file;
        
        // Render preview
        const url = URL.createObjectURL(file);
        imagePreview.src = url;
        
        // Show preview container and hide old results/errors
        previewContainer.classList.remove('hidden');
        if (document.getElementById('emptyStateContainer')) {
            document.getElementById('emptyStateContainer').classList.add('hidden');
        }
        btnAnalyze.disabled = false;
        
        hideError();
        resultsContainer.classList.add('hidden');
        if (document.getElementById('initialState')) {
            document.getElementById('initialState').classList.remove('hidden');
        }
    };

    cameraInput.addEventListener('change', handleFileSelection);
    uploadInput.addEventListener('change', handleFileSelection);

    btnAnalyze.addEventListener('click', async () => {
        if (!currentFile) return;

        // UI Reset for analysis phase
        loadingState.classList.remove('hidden');
        resultsContainer.classList.add('hidden');
        hideError();
        btnAnalyze.disabled = true;

        const formData = new FormData();
        formData.append('image', currentFile);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'حدث خطأ غير متوقع أثناء معالجة الطلب.');
            }

            displayResults(data);
        } catch (error) {
            showError(error.message);
        } finally {
            loadingState.classList.add('hidden');
            btnAnalyze.disabled = false;
        }
    });

    function displayResults(data) {
        document.getElementById('foodName').textContent = data.name || 'طعام غير معروف';
        
        // Format values with fallbacks
        document.getElementById('valCalories').textContent = (data.calories || 0) + ' سعرة';
        document.getElementById('valWeight').textContent = (data.weight || 0) + ' غ';
        document.getElementById('valProtein').textContent = (data.protein || 0) + ' غ';
        document.getElementById('valCarbs').textContent = (data.carbs || 0) + ' غ';
        document.getElementById('valFat').textContent = (data.fat || 0) + ' غ';
        document.getElementById('valConfidence').textContent = (data.confidence || 0) + '%';
        
        document.getElementById('valTips').textContent = data.tips || 'لا توجد نصائح غذائية متوفرة.';
        
        if (document.getElementById('initialState')) {
            document.getElementById('initialState').classList.add('hidden');
        }
        
        // Reveal results with smooth scroll
        resultsContainer.classList.remove('hidden');
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorState.classList.remove('hidden');
        errorState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideError() {
        errorState.classList.add('hidden');
    }
});
