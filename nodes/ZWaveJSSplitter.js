module.exports = (RED) => {
	const init = function (config) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;

		let clearTimer;
		const PinsCount = self.config.splits.length;
		const TotalPins = PinsCount + 1; // 1 exra for learned

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
			if (msg.topic === 'ClearLearnedNotifications') {
				self.context().set('LearnedNotifications', []);
				callback({
					Type: 'STATUS',
					Status: {
						fill: 'green',
						shape: 'dot',
						text: `Learned Notifications Cleared!`,
						clearTime: 5000
					}
				});
				done();
				return;
			}

			if (msg.topic === 'GetLearnedNotifications') {
				msg.payload = self.context().get('LearnedNotifications');
				send(msg);
				done();
				return;
			}

			if (msg.topic === 'LearnNotifications') {
				if (Array.isArray(msg.payload)) {
					msg.payload.forEach((N) => {
						const Event = N.event;
						const Name = N.name;
						if (!self.context().get('LearnedNotifications')) {
							self.context().set('LearnedNotifications', []);
						}
						self.context().get('LearnedNotifications').push({
							name: Name,
							event: Event
						});
					});
					callback({
						Type: 'STATUS',
						Status: {
							fill: 'green',
							shape: 'dot',
							text: `Event(s) Learned!`,
							clearTime: 5000
						}
					});
				} else {
					callback({
						Type: 'STATUS',
						Status: {
							fill: 'red',
							shape: 'dot',
							text: `msg.payload is not an array`,
							clearTime: 5000
						}
					});
				}

				done();
				return;
			}

			if (msg.payload?.event) {
				let Match;
				switch (msg.payload.event) {
					case 'VALUE_UPDATED':
					case 'VALUE_ADDED':
					case 'VALUE_NOTIFICATION':
						const VID = msg.payload?.eventBody?.valueId;
						if (VID) {
							Match = self.config.splits.find(
								(V) =>
									V.valueId?.commandClass === VID.commandClass &&
									V.valueId?.property === VID.property &&
									V.valueId?.propertyKey === VID.propertyKey
							);
						}
						break;
					case 'NOTIFICATION':
						if (self.context().get('LearnedNotifications')) {
							const Learned = self.context().get('LearnedNotifications');
							for (let i = 0; i < Learned.length; i++) {
								const Current = Learned[i];
								if (deepSubsetMatch(Current.event, msg.payload?.eventBody)) {
									Match = { ...Current, index: PinsCount };
								}
							}
						}
						break;
				}
				if (Match) {
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

					const out = new Array(TotalPins);
					out[PinIndex] = msg;
					send(out);
					done();
				} else {
					callback({
						Type: 'STATUS',
						Status: {
							fill: 'red',
							shape: 'dot',
							text: `No Match`,
							clearTime: 5000
						}
					});
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
