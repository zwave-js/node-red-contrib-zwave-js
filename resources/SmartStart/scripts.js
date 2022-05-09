/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
const ScannedCodes = {};
let _Prefix;

const getParam = (param) => {
	const queryString = window.location.search;
	const urlParams = new URLSearchParams(queryString);
	return urlParams.get(param);
};

function SetPrefix(Prefix) {
	_Prefix = Prefix;
}

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
			SendCode(code).then(() => {
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

async function SendActive() {
	return new Promise((resolve, reject) => {
		const Res = $.ajax({
			url: `${_Prefix}zwave-js/${getParam('net')}/smartstart-event/started`,
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

function SendCode(Code) {
	return new Promise((resolve) => {
		const Entry = ScannedCodes[Code.data];
		if (Entry !== undefined) {
			resolve();
		} else {
			let Result;
			$.ajax({
				url: `${_Prefix}zwave-js/${getParam('net')}/smartstart-event/code/${
					Code.data
				}`,
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
