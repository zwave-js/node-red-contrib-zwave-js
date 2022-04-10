/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
let canvasCTX;
let canvasElement;
let videoElement;
let offset;
const ScannedCodes = {};

function GrabImage() {
	SendActive()
		.then(() => {
			const FI = document.createElement('input');
			FI.hidden = true;
			document.body.append(FI);
			FI.addEventListener('change', SubmitPhoto, false);
			FI.setAttribute('type', 'file');
			FI.setAttribute('accept', 'image/*;capture=camera');
			FI.click();
		})
		.catch((Err) => {
			alert(Err);
		});
}

function SubmitPhoto(e) {
	const File = e.target.files[0];
	const _URL = URL.createObjectURL(File);
	const IMG = new Image();
	IMG.onload = function () {
		const MAX_WIDTH = 500;
		const MAX_HEIGHT = 500;

		let width = IMG.width;
		let height = IMG.height;

		if (width > height) {
			if (width > MAX_WIDTH) {
				height = height * (MAX_WIDTH / width);
				width = MAX_WIDTH;
			}
		} else {
			if (height > MAX_HEIGHT) {
				width = width * (MAX_HEIGHT / height);
				height = MAX_HEIGHT;
			}
		}

		const CV = document.createElement('canvas');
		CV.width = width;
		CV.height = height;
		CV.getContext('2d').drawImage(this, 0, 0, width, height);
		const ImageData = CV.getContext('2d').getImageData(0, 0, width, height);
		const code = jsQR(ImageData.data, ImageData.width, ImageData.height, {
			inversionAttempts: 'dontInvert'
		});
		if (code) {
			SendCode(code, true).then(() => {
				if (ScannedCodes[code.data].ok) {
					alert('Device Accepted.');
				} else {
					alert('Not A Smart Start Device.');
				}
			});
		} else {
			alert('No QR Found.');
		}
		URL.revokeObjectURL(_URL);
		e.target.remove();
		CV.remove();
	};
	IMG.src = _URL;
}

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
		});
}

function drawLine(begin, end, color) {
	canvasCTX.beginPath();
	canvasCTX.moveTo(begin.x + offset, begin.y + offset);
	canvasCTX.lineTo(end.x + offset, end.y + offset);
	canvasCTX.lineWidth = 8;
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
		const detectionArea = 250;
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
		canvasCTX.strokeStyle = 'blue';
		canvasCTX.strokeRect(offset, offset, detectionArea, detectionArea);

		// Slightly Darken Inner
		canvasCTX.fillStyle = 'rgba(0,0,0,0.0)';
		canvasCTX.fillRect(offset, offset, detectionArea, detectionArea);

		const imageData = canvasCTX.getImageData(
			offset,
			offset,
			detectionArea,
			detectionArea
		);
		const code = jsQR(imageData.data, imageData.width, imageData.height, {
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

async function SendActive() {
	return new Promise((resolve, reject) => {
		const Res = $.ajax({
			url: '../../../zwave-js/smartstart-event/started',
			method: 'get',
			async: false
		});
		if (Res.status === 200) {
			resolve();
		} else {
			reject('Smart start is not ready.');
		}
	});
}

function RenderOutline(Code, Color) {
	drawLine(Code.location.topLeftCorner, Code.location.topRightCorner, Color);
	drawLine(
		Code.location.topRightCorner,
		Code.location.bottomRightCorner,
		Color
	);
	drawLine(
		Code.location.bottomRightCorner,
		Code.location.bottomLeftCorner,
		Color
	);
	drawLine(Code.location.bottomLeftCorner, Code.location.topLeftCorner, Color);
}

function SendCode(Code, skipRender) {
	return new Promise((resolve) => {
		let Color;
		if (!skipRender) {
			Color = '#ffbf00';
			RenderOutline(Code, Color);
		}
		const Entry = ScannedCodes[Code.data];
		if (Entry !== undefined) {
			if (Entry.ok) {
				if (!skipRender) {
					Color = '#00FF00';
					RenderOutline(Code, Color);
				}
				resolve();
			} else {
				if (!skipRender) {
					Color = '#FF0000';
					RenderOutline(Code, Color);
				}
				resolve();
			}
		} else {
			let Result;
			$.ajax({
				url: '../../../zwave-js/smartstart-event/code/' + Code.data,
				method: 'get',
				success: (data) => {
					Result = data;
				},
				async: false
			});
			ScannedCodes[Code.data] = {};
			ScannedCodes[Code.data].ok = parseInt(Result) === 1 ? true : false;
			setTimeout(resolve, 250);
		}
	});
}

function EnableLive() {
	if (location.protocol === 'https:') {
		$('#LiveScanButton').css({ filter: '', pointerEvents: 'all' });
	}
}
