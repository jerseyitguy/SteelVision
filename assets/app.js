// SPDX-FileCopyrightText: Copyright (C) 2025 ARDUINO SA <http://www.arduino.cc>
//
// SPDX-License-Identifier: MPL-2.0

const recentDetectionsElement = document.getElementById('recentDetections');
const feedbackContentElement = document.getElementById('feedback-content');
const MAX_RECENT_SCANS = 5;
let scans = [];
const socket = io(`http://${window.location.host}`); // Initialize socket.io connection
let errorContainer = document.getElementById('error-container');
let handVisible = false;

// Set the video stream's actual processing resolution
const STREAM_WIDTH = 640.0;
const STREAM_HEIGHT = 480.0;

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    initSocketIO();
    initializeConfidenceSlider();
    
    initializeAlertZoneInputs(); 
    
    feedbackContentElement.innerHTML = `
        <img src="img/stars.svg" alt="Stars">
        <p class="feedback-text">System response will appear here</p>
    `;
    handVisible = false;
    renderDetections();

    // Popover logic
    const confidencePopoverText = "Minimum confidence score for detected faces. Lower values show more results but may include false positives.";
    const feedbackPopoverText = "When camera detects a face, an animation will appear here.";

    document.querySelectorAll('.info-btn.confidence').forEach(img => {
        const popover = img.nextElementSibling;
        img.addEventListener('mouseenter', () => {
            popover.textContent = confidencePopoverText;
            popover.style.display = 'block';
        });
        img.addEventListener('mouseleave', () => {
            popover.style.display = 'none';
        });
    });

    document.querySelectorAll('.info-btn.feedback').forEach(img => {
        const popover = img.nextElementSibling;
        img.addEventListener('mouseenter', () => {
            popover.textContent = feedbackPopoverText;
            popover.style.display = 'block';
        });
        img.addEventListener('mouseleave', () => {
            popover.style.display = 'none';
        });
    });
});

function initSocketIO() {
    let detectionTimeout;

    socket.on('connect', () => {
        if (errorContainer) {
            errorContainer.style.display = 'none';
            errorContainer.textContent = '';
        }
    });

    socket.on('disconnect', () => {
        if (errorContainer) {
            errorContainer.textContent = 'Connection to the board lost. Please check the connection.';
            errorContainer.style.display = 'block';
        }
    });

    // === THIS IS THE MODIFIED FUNCTION ===
    socket.on('detection', async (message) => {
        // Clear any existing 3-second timeout
        clearTimeout(detectionTimeout);
        
        printDetection(message);
        renderDetections();

        let isOutside = false;

        if (message.box && typeof message.box === 'object' && message.box !== null && !Array.isArray(message.box)) {
            
            const face = {
                x1: message.box.x / STREAM_WIDTH,
                y1: message.box.y / STREAM_HEIGHT,
                x2: (message.box.x + message.box.width) / STREAM_WIDTH,
                y2: (message.box.y + message.box.height) / STREAM_HEIGHT
            };

            const zX = parseFloat(document.getElementById('zoneX').value);
            const zY = parseFloat(document.getElementById('zoneY').value);
            const zW = parseFloat(document.getElementById('zoneW').value);
            const zH = parseFloat(document.getElementById('zoneH').value);
            const zone = { x1: zX, y1: zY, x2: zX + zW, y2: zY + zH };

            isOutside = face.x1 < zone.x1 || face.y1 < zone.y1 || face.x2 > zone.x2 || face.y2 > zone.y2;
        }

        // Get the current text element (if one exists)
        const currentFeedbackText = feedbackContentElement.querySelector('p');

        if (isOutside) {
            // Show the alert
            feedbackContentElement.innerHTML = `
                <img src="img/hand.gif" alt="Alert">
                <p style="color: red; font-weight: bold;">ALERT: Face outside zone!</p>
            `;
            handVisible = true; // Mark panel as active
        
        } else { // Face is INSIDE the zone
            
            // We update the message IF:
            // 1. The panel is not active (!handVisible)
            // 2. The panel is *currently* showing the alert (text color is red)
            if (!handVisible || (currentFeedbackText && currentFeedbackText.style.color === 'red')) {
                const greetings = ["Hello!", "Hi there!", "Hey!", "Nice to see you!", "Great to have you here!", "I see you", "Looking good!", "There you are!", "Howdy!", "Happy to see a face!", "Hi, friend!", "Face detected!", "Hello, human!"];
                const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
                feedbackContentElement.innerHTML = `
                    <img src="img/hand.gif" alt="Hand">
                    <p>${randomGreeting}</p> `;
            }
            handVisible = true; // Mark panel as active
        }

        // Set a new timeout to reset the panel after 3s of NO detections
        detectionTimeout = setTimeout(() => {
            feedbackContentElement.innerHTML = `
                <img src="img/stars.svg" alt="Stars">
                <p class="feedback-text">System response will appear here</p>
            `;
            handVisible = false; // Panel is no longer active
        }, 3000); 
    });
    // === END OF MODIFIED FUNCTION ===

}

function printDetection(newDetection) {
    scans.unshift(newDetection);
    if (scans.length > MAX_RECENT_SCANS) { scans.pop(); }
}

function renderDetections() {
    recentDetectionsElement.innerHTML = ``;

    if (scans.length === 0) {
        recentDetectionsElement.innerHTML = `
            <div class="no-recent-scans">
                <img src="./img/no-face.svg">
                No face detected yet
            </div>
        `;
        return;
    }

    scans.forEach((scan) => {
        const row = document.createElement('div');
        row.className = 'scan-container';
        const cellContainer = document.createElement('span');
        cellContainer.className = 'scan-cell-container cell-border';
        const contentText = document.createElement('span');
        contentText.className = 'scan-content';
        
		const value = scan.confidence; 
		const result = Math.floor(value * 1000) / 10;
        contentText.innerHTML = `${result}% - Face`;
        
        const timeText = document.createElement('span');
        timeText.className = 'scan-content-time';
        timeText.textContent = new Date(scan.timestamp).toLocaleString('it-IT').replace(',', ' -');

        cellContainer.appendChild(contentText);
        cellContainer.appendChild(timeText);
        row.appendChild(cellContainer);
        recentDetectionsElement.appendChild(row);
    });
}


function initializeConfidenceSlider() {
    const confidenceSlider = document.getElementById('confidenceSlider');
    const confidenceInput = document.getElementById('confidenceInput');
    const confidenceResetButton = document.getElementById('confidenceResetButton');

    confidenceSlider.addEventListener('input', updateConfidenceDisplay);
    confidenceInput.addEventListener('input', handleConfidenceInputChange);
    confidenceInput.addEventListener('blur', validateConfidenceInput);
    updateConfidenceDisplay();

    confidenceResetButton.addEventListener('click', (e) => {
        if (e.target.classList.contains('reset-icon') || e.target.closest('.reset-icon')) {
            resetConfidence();
        }
    });
}

function handleConfidenceInputChange() {
    const confidenceInput = document.getElementById('confidenceInput');
    const confidenceSlider = document.getElementById('confidenceSlider');
    let value = parseFloat(confidenceInput.value);
    if (isNaN(value)) value = 0.5;
    if (value < 0) value = 0;
    if (value > 1) value = 1;
    confidenceSlider.value = value;
    updateConfidenceDisplay();
}

function validateConfidenceInput() {
    const confidenceInput = document.getElementById('confidenceInput');
    let value = parseFloat(confidenceInput.value);
    if (isNaN(value)) value = 0.5;
    if (value < 0) value = 0;
    if (value > 1) value = 1;
    confidenceInput.value = value.toFixed(2);
    handleConfidenceInputChange();
}

function updateConfidenceDisplay() {
    const confidenceSlider = document.getElementById('confidenceSlider');
    const confidenceInput = document.getElementById('confidenceInput');
    const confidenceValueDisplay = document.getElementById('confidenceValueDisplay');
    const sliderProgress = document.getElementById('sliderProgress');
    const value = parseFloat(confidenceSlider.value);
    socket.emit('override_th', value); 
    const percentage = (value - confidenceSlider.min) / (confidenceSlider.max - confidenceSlider.min) * 100;
    const displayValue = value.toFixed(2);
    confidenceValueDisplay.textContent = displayValue;
    if (document.activeElement !== confidenceInput) {
        confidenceInput.value = displayValue;
    }
    sliderProgress.style.width = percentage + '%';
    confidenceValueDisplay.style.left = percentage + '%';
}

function resetConfidence() {
    const confidenceSlider = document.getElementById('confidenceSlider');
    const confidenceInput = document.getElementById('confidenceInput');
    confidenceSlider.value = '0.5';
    confidenceInput.value = '0.50';
    updateConfidenceDisplay();
}

function initializeAlertZoneInputs() {
    const inputs = ['zoneX', 'zoneY', 'zoneW', 'zoneH'];
    
    inputs.forEach(id => {
        const inputElement = document.getElementById(id);
        if (inputElement) {
            inputElement.addEventListener('input', updateAlertZoneBox);
        }
    });
    updateAlertZoneBox();
}

function updateAlertZoneBox() {
    try {
        const zX = parseFloat(document.getElementById('zoneX').value);
        const zY = parseFloat(document.getElementById('zoneY').value);
        const zW = parseFloat(document.getElementById('zoneW').value);
        const zH = parseFloat(document.getElementById('zoneH').value);
        
        const box = document.getElementById('alertZoneBox');
        if (!box) return; 

        box.style.left = (zX * 100) + '%';
        box.style.top = (zY * 100) + '%';
        box.style.width = (zW * 100) + '%';
        box.style.height = (zH * 100) + '%';
        
    } catch (e) {
        console.error("Error updating alert zone box:", e);
    }
}