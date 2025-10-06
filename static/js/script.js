document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const helpBtn = document.getElementById('help-btn');
    const recommendationContainer = document.getElementById('recommendation-container');
    const recommendationSpinner = document.getElementById('recommendation-spinner');
    const recommendationContent = document.getElementById('recommendation-content');
    const uploadForm = document.getElementById('upload-form');
    const uploadArea = document.getElementById('upload-area');
    const uploadPrompt = document.getElementById('upload-prompt');
    const selectImageBtn = document.getElementById('select-image-btn');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultContainer = document.getElementById('result-container');
    const analyzeAnotherBtn = document.getElementById('analyze-another-btn');
    const resultDisease = document.getElementById('result-disease');
    const confidenceLevel = document.getElementById('confidence-level');
    const confidenceText = document.getElementById('confidence-text');
    const btnText = analyzeBtn.querySelector('.btn-text');
    const spinner = analyzeBtn.querySelector('.spinner');

    // Hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png, image/jpeg, image/webp';
    fileInput.style.display = 'none';
    
    let currentFile = null;

    // --- Event Listeners ---

    // Trigger file input click
    selectImageBtn.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('click', (e) => {
        if (e.target === uploadArea || e.target === uploadPrompt || e.target.parentNode === uploadPrompt) {
            fileInput.click();
        }
    });

    // Handle file selection
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });

    // Drag and Drop functionality
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('is-dragging');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('is-dragging');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('is-dragging');
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    });

    // Remove selected image
    removeImageBtn.addEventListener('click', resetUI);

    // Form submission
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (currentFile) {
            uploadAndPredict(currentFile);
        }
    });
    
    // Analyze another image
    analyzeAnotherBtn.addEventListener('click', resetUI);
    // --- Add this event listener after your other listeners ---
    helpBtn.addEventListener('click', async () => {
        const diseaseName = resultDisease.textContent;
        
        // Show the recommendation area with a spinner
        recommendationContainer.classList.remove('hidden');
        recommendationSpinner.classList.remove('hidden');
        recommendationContent.classList.add('hidden');
        helpBtn.disabled = true; // Prevent multiple clicks

        try {
            const response = await fetch('/get_recommendation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ disease: diseaseName }),
            });

            if (!response.ok) {
                throw new Error('Failed to get recommendation.');
            }

            const data = await response.json();

            // Convert Markdown from Gemini to HTML
            // For a simple conversion, we can replace some common markdown.
            // For a more robust solution, consider a library like 'marked.js'.
            recommendationContent.innerHTML = marked.parse(data.recommendation);

        } catch (error) {
            console.error('Error fetching recommendation:', error);
            recommendationContent.innerHTML = '<p>Sorry, we could not retrieve advice at this time. Please try again later.</p>';
        } finally {
            // Hide spinner and show the content
            recommendationSpinner.classList.add('hidden');
            recommendationContent.classList.remove('hidden');
        }
    });


    // --- Core Functions ---

    function handleFile(file) {
        // Simple file validation
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Invalid file type. Please select a JPG, PNG, or WEBP image.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) { // 10MB
            alert('File is too large. Maximum size is 10MB.');
            return;
        }

        currentFile = file;
        displayImagePreview(file);
    }

    function displayImagePreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // Update UI
        uploadPrompt.classList.add('hidden');
        imagePreviewContainer.classList.remove('hidden');
        analyzeBtn.classList.remove('hidden');
        resultContainer.classList.add('hidden'); // Hide previous results
    }

    async function uploadAndPredict(file) {
        const formData = new FormData();
        formData.append('file', file);

        // Show loading state
        setLoading(true);

        try {
            const response = await fetch('/predict', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            displayResults(data);

        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during analysis. Please try again.');
        } finally {
            // Hide loading state
            setLoading(false);
        }
    }

    function displayResults(data) {
        const diseaseName = data.prediction.replace(/_/g, ' '); // Replace underscores with spaces
        const confidence = (data.confidence * 100).toFixed(2);

        resultDisease.textContent = diseaseName;
        confidenceText.textContent = `${confidence}%`;
        
        // Animate the progress bar
        confidenceLevel.style.width = `${confidence}%`;

        // Update UI
        uploadForm.classList.add('hidden');
        resultContainer.classList.remove('hidden');
    }
    
    function resetUI() {
        currentFile = null;
        fileInput.value = ''; // Clear the file input

        // Reset UI to initial state
        uploadForm.classList.remove('hidden');
        uploadPrompt.classList.remove('hidden');
        imagePreviewContainer.classList.add('hidden');
        imagePreview.src = '';
        analyzeBtn.classList.add('hidden');
        resultContainer.classList.add('hidden');
        recommendationContainer.classList.add('hidden');
        helpBtn.disabled = false; // Re-enable the button
        
        // Reset progress bar
        confidenceLevel.style.width = '0%';
    }
    
    function setLoading(isLoading) {
        if (isLoading) {
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
            analyzeBtn.disabled = true;
        } else {
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    }
});