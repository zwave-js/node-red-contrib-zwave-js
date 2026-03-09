module.exports = (RED) => {
	const init = function (config) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;

		let clearTimer;

		const deepSubsetMatch = (Profile, Candidate) => {
			if (Profile === Candidate) return true;
			if (Profile === null || typeof Profile !== 'object') return Profile === Candidate;
			if (Array.isArray(Profile)) {
				if (!Array.isArray(Candidate)) return false;

				return Profile.every((p) => Candidate.some((c) => deepSubsetMatch(p, c)));
			}
			if (typeof Candidate !== 'object' || Candidate === null) return false;
			return Object.keys(Profile).every((key) => deepSubsetMatch(Profile[key], Candidate[key]));
		};
		const callback = (Data) => {
			switch (Data.Type) {
				case 'STATUS':
					self.status(Data.Status);
					if (clearTimer) (clearTimeout(clearTimer), (clearTimer = undefined));

					if (Data.Status.clearTime) {
						clearTimer = setTimeout(() => {
							self.status({});
						}, Data.Status.clearTime);
					}
					break;
			}
		};

		self.on('input', (msg, send, done) => {
			if (msg.payload?.event) {
				let Match;
				let VID;
				let Customised;
				let Valid = false;
				switch (msg.payload.event) {
					case 'VALUE_UPDATED':
					case 'VALUE_ADDED':
					case 'VALUE_NOTIFICATION':
					case 'NOTIFICATION':
						Valid = true;
						VID = msg.payload?.eventBody?.valueId;
						if (VID) {
							Match = self.config.splits.find(
								(V) =>
									V.valueId?.commandClass === VID.commandClass &&
									V.valueId?.property === VID.property &&
									V.valueId?.propertyKey === VID.propertyKey
							);
						}
						break;
				}

				if (Valid && !Match) {
					Customised = self.config.splits.filter((S) => S.custom);
					for (let i = 0; i < Customised; i++) {
						const Current = Customised[i];
						if (deepSubsetMatch(Current.valueId, msg.payload?.eventBody)) {
							Match = Current;
							break;
						}
					}
				}

				if (Valid && Match) {
					callback({
						Type: 'STATUS',
						Status: {
							fill: 'green',
							shape: 'dot',
							text: `Match: ${Match.name}, Pin: ${Match.index + 1}`,
							clearTime: 5000
						}
					});
					const PinIndex = Match.index;
					msg.split = {
						name: Match.name,
						outputPin: PinIndex
					};

					const out = new Array(self.config.splits.length);
					out[PinIndex] = msg;
					send(out);
					done();
				} else {
					if (Valid) {
						callback({
							Type: 'STATUS',
							Status: {
								fill: 'red',
								shape: 'dot',
								text: 'No Match',
								clearTime: 5000
							}
						});
					}
					done();
				}
			}
		});

		self.on('close', (_, done) => {
			done();
		});
	};

	RED.nodes.registerType('zwavejs-splitter', init);
};
