/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
let canvasCTX;
let canvasElement;
let videoElement;
let offset;
const ScannedCodes = [];

function Start() {
	canvasElement = $('#CameraView')[0];
	canvasCTX = canvasElement.getContext('2d');
	videoElement = document.createElement('video');

	navigator.mediaDevices
		.getUserMedia({ video: { facingMode: 'environment', zoom: true } })
		.then(function (stream) {
			videoElement.srcObject = stream;
			videoElement.setAttribute('playsinline', true); // required to tell iOS safari we don't want fullscreen
			videoElement.play();
			requestAnimationFrame(tick);

			const [track] = stream.getVideoTracks();
			const capabilities = track.getCapabilities();
			const settings = track.getSettings();

			if ('zoom' in settings) {
				const Z = document.getElementById('VideoZOOM');
				Z.min = capabilities.zoom.min;
				Z.max = capabilities.zoom.max;
				Z.step = capabilities.zoom.step;
				Z.value = settings.zoom;
				Z.oninput = function (event) {
					track.applyConstraints({
						advanced: [{ zoom: event.target.value }]
					});
				};
				Z.style.display = 'block';
			}
		});
}

function drawLine(begin, end, color) {
	canvasCTX.beginPath();
	canvasCTX.moveTo(begin.x + offset, begin.y + offset);
	canvasCTX.lineTo(end.x + offset, end.y + offset);
	canvasCTX.lineWidth = 6;
	canvasCTX.strokeStyle = color;
	canvasCTX.stroke();
}

function tick() {
	if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
		// Draw
		canvasElement.hidden = false;
		canvasElement.height = videoElement.videoHeight;
		canvasElement.width = videoElement.videoWidth;
		canvasCTX.drawImage(
			videoElement,
			0,
			0,
			canvasElement.width,
			canvasElement.height
		);

		// Size
		const detectionArea = 200;
		const size = Math.min(videoElement.videoWidth, videoElement.videoHeight);
		offset = (size - detectionArea) / 2;

		// Darken
		canvasCTX.fillStyle = 'rgba(0,0,0,0.6)';
		canvasCTX.fillRect(0, 0, videoElement.videoWidth, videoElement.videoHeight);

		// Clip (for redraw)
		canvasCTX.rect(offset, offset, detectionArea, detectionArea);
		canvasCTX.clip();

		// Redraw
		canvasCTX.drawImage(
			videoElement,
			0,
			0,
			canvasElement.width,
			canvasElement.height
		);

		// Border
		canvasCTX.lineWidth = 6;
		canvasCTX.strokeStyle = '#FF3B58';
		canvasCTX.strokeRect(offset, offset, detectionArea, detectionArea);

		// Slightly Darken Inner
		canvasCTX.fillStyle = 'rgba(0,0,0,0.0)';
		canvasCTX.fillRect(offset, offset, detectionArea, detectionArea);

		var imageData = canvasCTX.getImageData(
			offset,
			offset,
			detectionArea,
			detectionArea
		);
		var code = jsQR(imageData.data, imageData.width, imageData.height, {
			inversionAttempts: 'dontInvert'
		});
		if (code) {
			SendCode(code).then(() => {
				requestAnimationFrame(tick);
			});
		} else {
			requestAnimationFrame(tick);
		}
	} else {
		requestAnimationFrame(tick);
	}
}

function SendActive() {
	return new Promise((resolve) => {
		$.ajax({ url: '/event.started', method: 'get', async: false });
		resolve();
	});
}

function SendCode(Code) {
	return new Promise((resolve) => {
		if (!ScannedCodes.includes(Code.data)) {
			ScannedCodes.push(Code.data);

			drawLine(
				Code.location.topLeftCorner,
				Code.location.topRightCorner,
				'#00FF00'
			);
			drawLine(
				Code.location.topRightCorner,
				Code.location.bottomRightCorner,
				'#00FF00'
			);
			drawLine(
				Code.location.bottomRightCorner,
				Code.location.bottomLeftCorner,
				'#00FF00'
			);
			drawLine(
				Code.location.bottomLeftCorner,
				Code.location.topLeftCorner,
				'#00FF00'
			);
			$.ajax({ url: '/event.code/' + Code.data, method: 'get', async: false });
			resolve();
		} else {
			resolve();
		}
	});
}
