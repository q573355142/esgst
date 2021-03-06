import JSZip from 'jszip';

// @ts-ignore
Cu.importGlobalProperties(['fetch', 'FileReader']);

// @ts-ignore
const file = FileUtils.getFile('ProfD', ['esgst.sqlite']);

const TYPE_SET = 0;
const TYPE_GET = 1;
const TYPE_DEL = 2;

const workers = new Set();
let storage = {};
let isTemporaryStorage = false;
let storageChanges = null;
let lastSaved = 0;

// @ts-ignore
buttons.ActionButton({
	id: 'esgst',
	label: 'ESGST',
	icon: {
		'16': './icon-16.png',
		'32': './icon-32.png',
		'64': './icon-64.png',
	},
	onClick: handleClick,
});

function handleClick(state) {
	// @ts-ignore
	tabs.open('https://www.steamgifts.com/account/settings/profile?esgst=settings');
}

function handle_storage(operation, values) {
	return new Promise((resolve) => {
		// @ts-ignore
		const dbConn = Services.storage.openDatabase(file);
		dbConn.executeSimpleSQL(`CREATE TABLE IF NOT EXISTS esgst (key TEXT NOT NULL, value TEXT)`);
		dbConn.executeSimpleSQL(`CREATE UNIQUE INDEX IF NOT EXISTS idx_esgst_key ON esgst (key)`);
		const statements = [];
		switch (operation) {
			case TYPE_SET: {
				const stmt = dbConn.createStatement(
					`INSERT OR REPLACE INTO esgst (key, value) VALUES (:key, :value)`
				);
				const params = stmt.newBindingParamsArray();
				for (const key in values) {
					const bp = params.newBindingParams();
					bp.bindByName('key', key);
					bp.bindByName('value', values[key]);
					params.addParams(bp);
				}
				stmt.bindParameters(params);
				statements.push(stmt);
				break;
			}
			case TYPE_GET: {
				if (values) {
					const stmt = dbConn.createStatement(
						`INSERT OR IGNORE INTO esgst (key, value) VALUES (:key, :value)`
					);
					const params = stmt.newBindingParamsArray();
					for (const key in values) {
						const bp = params.newBindingParams();
						bp.bindByName('key', key);
						bp.bindByName('value', values[key]);
						params.addParams(bp);
					}
					stmt.bindParameters(params);
					statements.push(stmt);
					const conditions = [];
					let i = 0;
					const n = Object.keys(values).length;
					while (i < n) {
						conditions.push(`key = :key${i++}`);
					}
					const select_stmt = dbConn.createStatement(
						`SELECT * FROM esgst WHERE ${conditions.join(' OR ')}`
					);
					i = 0;
					for (const key in values) {
						select_stmt.params[`key${i}`] = key;
					}
					statements.push(select_stmt);
				} else {
					const select_stmt = dbConn.createStatement('SELECT * FROM esgst');
					statements.push(select_stmt);
				}
				break;
			}
			case TYPE_DEL: {
				const conditions = [];
				let i = 0;
				const n = values.length;
				while (i < n) {
					conditions.push(`key = :key${i++}`);
				}
				const stmt = dbConn.createStatement(`DELETE FROM esgst WHERE ${conditions.join(' OR ')}`);
				i = 0;
				for (const key of values) {
					stmt.params[`key${i}`] = key;
				}
				statements.push(stmt);
				break;
			}
		}
		const output = {};
		dbConn.executeAsync(statements, statements.length, {
			handleCompletion: (aReason) => {},
			handleError: (aError) => {},
			handleResult: (aResultSet) => {
				let row;
				do {
					row = aResultSet.getNextRow();
					if (row) {
						output[row.getResultByName('key')] = row.getResultByName('value');
					}
				} while (row);
			},
		});
		dbConn.asyncClose(() => resolve(output));
	});
}
const loadStorage = () => handle_storage(TYPE_GET, null).then((result) => (storage = result));

loadStorage().then(async () => {
	const settings = storage.settings ? JSON.parse(storage.settings) : {};
	if (settings.useTemporaryStorage_sg || settings.useTemporaryStorage_st) {
		isTemporaryStorage = true;
	}
	if (!settings.activateTab_sg && !settings.activateTab_st) {
		return;
	}
	// Get the currently active tab.
	// @ts-ignore
	const currentTab = tabs.activeTab;
	if (settings.activateTab_sg) {
		// Set the SG tab as active.
		activateTab('steamgifts');
	}
	if (settings.activateTab_st) {
		// Set the ST tab as active.
		activateTab('steamtrades');
	}
	// Go back to the previously active tab.
	if (currentTab && currentTab.id) {
		currentTab.activate();
	}
});

let checkSaveTimeout = 0;

const keepCheckingSave = async () => {
	await checkSave();
	checkSaveTimeout = setTimeout(keepCheckingSave, 60000);
};

const checkSave = async (force) => {
	const now = Date.now();
	//Cu.reportError(JSON.stringify(storageChanges));
	//Cu.reportError(`Checking... ${force} ${now - lastSaved}`);
	if (storageChanges && (force || now - lastSaved > 60000)) {
		const storageChangesBkp = storageChanges;
		storageChanges = null;
		lastSaved = now;
		//Cu.reportError('Saving storage...');
		await handle_storage(TYPE_SET, storageChangesBkp);
		//Cu.reportError('Storage saved!');
		sendMessage('storageSaved', null, now, true);
	}
};

function sendMessage(action, sender, values, sendToAll) {
	for (const worker of workers) {
		if (sender && worker === sender) {
			continue;
		}
		worker.port.emit('esgstMessage', JSON.stringify({ action, values }));
		if (!sender && !sendToAll) {
			return;
		}
	}
}

async function getZip(data, fileName) {
	const zip = new JSZip();
	zip.file(fileName, data);
	return await zip.generateAsync({
		compression: 'DEFLATE',
		compressionOptions: {
			level: 9,
		},
		type: 'uint8array',
	});
}

async function readZip(data) {
	const zip = new JSZip(),
		contents = await zip.loadAsync(data),
		keys = Object.keys(contents.files),
		output = [];
	for (const key of keys) {
		output.push({
			name: key,
			value: await zip.file(key).async('text'),
		});
	}
	return output;
}

function doFetch(parameters, request) {
	return new Promise(async (resolve) => {
		if (request.fileName) {
			parameters.body = await getZip(parameters.body, request.fileName);
		}

		let response = null;
		let responseText = null;
		try {
			response = await fetch(request.url, parameters);
			if (request.blob) {
				const blob = await response.blob();
				const reader = new FileReader();
				const binaryString = await new Promise((resolve) => {
					reader.onload = () => resolve(reader.result);
					reader.readAsBinaryString(blob);
				});
				responseText = (await readZip(binaryString))[0].value;
			} else {
				responseText = await response.text();
			}
			if (!response.ok) {
				throw responseText;
			}
		} catch (error) {
			resolve(JSON.stringify({ error }));
			return;
		}
		resolve(
			JSON.stringify({
				finalUrl: response.url,
				redirected: response.redirected,
				responseText: responseText,
			})
		);
	});
}

async function detachWorker(worker) {
	//Cu.reportError(worker);
	workers.delete(worker);
	if (workers.size > 0) {
		return;
	}
	await checkSave(true);
	if (checkSaveTimeout) {
		clearTimeout(checkSaveTimeout);
		checkSaveTimeout = 0;
	}
}

const locks = {};

function do_lock(lock) {
	return new Promise((resolve) => {
		_do_lock(lock, resolve);
	});
}

function _do_lock(lock, resolve) {
	const now = Date.now();
	let locked = locks[lock.key];
	if (
		!locked ||
		!locked.uuid ||
		locked.timestamp < now - (lock.threshold + (lock.timeout || 15000))
	) {
		locks[lock.key] = {
			timestamp: now,
			uuid: lock.uuid,
		};
		setTimeout(() => {
			locked = locks[lock.key];
			if (!locked || locked.uuid !== lock.uuid) {
				if (!lock.lockOrDie) {
					setTimeout(() => _do_lock(lock, resolve), 0);
				} else {
					resolve('false');
				}
			} else {
				resolve('true');
			}
		}, lock.threshold / 2);
	} else if (!lock.lockOrDie) {
		setTimeout(() => _do_lock(lock, resolve), lock.threshold / 3);
	} else {
		resolve('false');
	}
}

function update_lock(lock) {
	const locked = locks[lock.key];
	if (locked.uuid === lock.uuid) {
		locked.timestamp = Date.now();
	}
}

function do_unlock(lock) {
	if (locks[lock.key] && locks[lock.key].uuid === lock.uuid) {
		delete locks[lock.key];
	}
}

let tdsData = [];

// @ts-ignore
PageMod({
	include: ['*.steamgifts.com', '*.steamtrades.com'],
	// @ts-ignore
	contentScriptFile: data.url('esgst.js'),
	contentScriptWhen: 'start',
	onAttach: (worker) => {
		let parameters;

		workers.add(worker);

		worker.on('detach', () => {
			detachWorker(worker);
		});

		worker.port.on('get-tds', (request) => {
			worker.port.emit(`get-tds_${request.uuid}_response`, JSON.stringify(tdsData));
		});

		worker.port.on('notify-tds', (request) => {
			tdsData = JSON.parse(request.data);

			sendMessage('notify-tds', null, tdsData, true);

			worker.port.emit(`notify-tds_${request.uuid}_response`, 'null');
		});

		worker.port.on('permissions_contains', (request) => {
			worker.port.emit(`permissions_contains_${request.uuid}_response`, 'true');
		});

		worker.port.on('getBrowserInfo', (request) => {
			worker.port.emit(`getBrowserInfo_${request.uuid}_response`, `{ "name": "?" }`);
		});

		worker.port.on('do_lock', async (request) => {
			const result = await do_lock(JSON.parse(request.lock));
			worker.port.emit(`do_lock_${request.uuid}_response`, result);
		});

		worker.port.on('update_lock', (request) => {
			update_lock(JSON.parse(request.lock));
			worker.port.emit(`update_lock_${request.uuid}_response`, 'null');
		});

		worker.port.on('do_unlock', (request) => {
			do_unlock(JSON.parse(request.lock));
			worker.port.emit(`do_unlock_${request.uuid}_response`, 'null');
		});

		worker.port.on('delValues', async (request) => {
			const keys = JSON.parse(request.keys);
			await handle_storage(TYPE_DEL, keys);
			worker.port.emit(`delValues_${request.uuid}_response`, 'null');
			const changes = {};
			for (const key of keys) {
				changes[key] = {
					newValue: 'null',
				};
			}
			sendMessage('storageChanged', worker, { changes, areaName: 'local' });
		});

		worker.port.on('fetch', async (request) => {
			parameters = JSON.parse(request.parameters);
			const response = await doFetch(parameters, request);
			worker.port.emit(`fetch_${request.uuid}_response`, response);
		});

		worker.port.on('getPackageJson', (request) => {
			// @ts-ignore
			worker.port.emit(`getPackageJson_${request.uuid}_response`, JSON.stringify(packageJson));
		});

		worker.port.on('getStorage', async (request) => {
			const storage = await handle_storage(TYPE_GET, null);
			worker.port.emit(`getStorage_${request.uuid}_response`, JSON.stringify(storage));
		});

		worker.port.on('reload', (request) => {
			worker.port.emit(`reload_${request.uuid}_response`, 'null');
		});

		worker.port.on('setValues', async (request) => {
			const values = JSON.parse(request.values);
			await handle_storage(TYPE_SET, values);
			worker.port.emit(`setValues_${request.uuid}_response`, 'null');
			const changes = {};
			for (const key in values) {
				changes[key] = {
					newValue: values[key],
				};
			}
			sendMessage('storageChanged', worker, { changes, areaName: 'local' });
		});

		worker.port.on('tabs', (request) => {
			getTabs(request);
			worker.port.emit(`tabs_${request.uuid}_response`, 'null');
		});

		worker.port.on('open_tab', (request) => {
			tabs.open(request.url);
			worker.port.emit(`open_tab_${request.uuid}_response`, 'null');
		});

		worker.port.on('get_storage', async (request) => {
			if (isTemporaryStorage) {
				if (!checkSaveTimeout) {
					await keepCheckingSave();
				}
				if (Object.keys(storage).length === 0) {
					await loadStorage();
				}
				worker.port.emit(`get_storage_${request.uuid}_response`, JSON.stringify(storage));
			} else {
				worker.port.emit(`get_storage_${request.uuid}_response`, 'null');
			}
		});

		worker.port.on('set_values', async (request) => {
			if (!storageChanges) {
				storageChanges = {};
			}
			const newValues = {
				changes: {},
				areaName: 'local',
			};
			const values = JSON.parse(request.values);
			for (const key in values) {
				storage[key] = values[key];
				storageChanges[key] = values[key];
				newValues.changes[key] = { newValue: values[key] };
			}
			await checkSave();
			sendMessage('storageChanged', worker, newValues, true);
			worker.port.emit(`set_values_${request.uuid}_response`, 'null');
		});

		worker.port.on('del_values', async (request) => {
			if (!storageChanges) {
				storageChanges = {};
			}
			const newValues = {
				changes: {},
				areaName: 'local',
			};
			const keys = JSON.parse(request.keys);
			for (const key of keys) {
				storage[key] = null;
				storageChanges[key] = null;
				newValues.changes[key] = { newValue: null };
			}
			await checkSave();
			sendMessage('storageChanged', worker, newValues, true);
			worker.port.emit(`del_values_${request.uuid}_response`, 'null');
		});

		worker.port.on('get_last_saved', () => {
			worker.port.emit(`get_last_saved_${request.uuid}_response`, lastSaved);
		});

		worker.port.on('save', async (request) => {
			await checkSave(true);
			worker.port.emit(`save_${request.uuid}_response`, 'null');
		});
	},
});

function getTabs(request) {
	let items = [
		{
			id: 'inbox_sg',
			pattern: /.*:\/\/.*\.steamgifts\.com\/messages.*/,
			url: `https://www.steamgifts.com/messages`,
		},
		{
			id: 'inbox_st',
			pattern: /.*:\/\/.*\.steamtrades\.com\/messages.*/,
			url: `https://www.steamtrades.com/messages`,
		},
		{
			id: 'wishlist',
			pattern: /.*:\/\/.*\.steamgifts\.com\/giveaways\/search\?.*type=wishlist.*/,
			url: `https://www.steamgifts.com/giveaways/search?type=wishlist`,
		},
		{
			id: 'won',
			pattern: /.*:\/\/.*\.steamgifts\.com\/giveaways\/won.*/,
			url: `https://www.steamgifts.com/giveaways/won`,
		},
	];
	let any = false;
	for (let i = 0, n = items.length; i < n; i++) {
		let item = items[i];
		if (!request[item.id]) {
			continue;
		}
		let tab = Array.from(workers)
			.map((worker) => worker.tab)
			.filter((tab) => tab.url.match(item.pattern))[0];
		if (tab && tab.id) {
			tab.activate();
			if (request.refresh) {
				tab.reload();
			}
		} else if (request.any) {
			any = true;
		} else {
			// @ts-ignore
			tabs.open(item.url);
		}
	}
	if (any) {
		let tab = Array.from(workers)
			.map((worker) => worker.tab)
			.filter((tab) => tab.url.match(/.*:\/\/.*\.steamgifts\.com\/.*/))[0];
		if (tab && tab.id) {
			tab.activate();
		}
	}
}

function activateTab(host) {
	const tab = Array.from(workers)
		.map((worker) => worker.tab)
		.filter((tab) => tab.url.match(new RegExp(`.*:\\/\\/.*\\.${host}\\.com\\/.*`)))[0];
	if (tab && tab.id) {
		tab.activate();
	}
}
