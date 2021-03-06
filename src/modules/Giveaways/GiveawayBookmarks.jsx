import { Button } from '../../class/Button';
import { DOM } from '../../class/DOM';
import { Module } from '../../class/Module';
import { Popup } from '../../class/Popup';
import { Settings } from '../../class/Settings';
import { Shared } from '../../class/Shared';
import { Tabs } from '../../class/Tabs';
import { Button as ButtonComponent } from '../../components/Button';
import { PageHeading } from '../../components/PageHeading';
import { common } from '../Common';

const createElements = common.createElements.bind(common),
	createLock = common.createLock.bind(common),
	endless_load = common.endless_load.bind(common),
	getFeatureTooltip = common.getFeatureTooltip.bind(common),
	getValue = common.getValue.bind(common),
	lockAndSaveGiveaways = common.lockAndSaveGiveaways.bind(common),
	request = common.request.bind(common),
	setValue = common.setValue.bind(common);
class GiveawaysGiveawayBookmarks extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Adds a button (<i className="fa fa-bookmark"></i> if the giveaway is bookmarked and{' '}
						<i className="fa fa-bookmark-o"></i> if it is not) next to a giveaway's game name (in
						any page) that allows you to bookmark the giveaway so that you can enter it later.
					</li>
					<li>
						Adds a button (<i className="fa fa-bookmark"></i>) next to the ESGST button at the
						header of any page that allows you to view all of the giveaways that have been
						bookmarked.
					</li>
				</ul>
			),
			features: {
				gb_u: {
					name: 'Automatically unbookmark ended giveaways.',
					sg: true,
				},
				gb_ue: {
					name: 'Automatically unbookmark entered giveaways.',
					sg: true,
				},
				gb_ui: {
					name: 'Automatically unbookmark inaccessible giveaways.',
					sg: true,
				},
				gb_h: {
					description: () => (
						<ul>
							<li>
								When giveaways that hadn't started start, the button will turn green, indicating
								that you must open the list of bookmarked giveaways so that the started giveaways
								can be updated with their end times.
							</li>
							<li>
								When giveaways are about to end (based on the number of hours specified below), the
								button will turn red.
							</li>
							<li>
								If there are both started and ending giveaways, the button will be colored with a
								brown-ish color, as a mixture of the green and red colors.
							</li>
							<li>
								If you hover over the button, it shows more details about how many giveaways have
								started and/or are ending.
							</li>
						</ul>
					),
					inputItems: [
						{
							id: 'gb_hours',
							prefix: `Time range to trigger highlight: `,
							suffix: ' hours',
						},
					],
					name: 'Highlight the header button when giveaways have started and/or are about to end.',
					sg: true,
				},
				gb_t: {
					name: 'Open the list of bookmarked giveaways in a new tab.',
					sg: true,
				},
				gb_se: {
					name: 'Show the button for entered giveaways.',
					sg: true,
				},
			},
			id: 'gb',
			name: 'Giveaway Bookmarks',
			sg: true,
			type: 'giveaways',
			featureMap: {
				giveaway: this.gb_getGiveaways.bind(this),
			},
		};
	}

	init() {
		let button = Shared.header.addButtonContainer({
			buttonIcon: 'fa fa-bookmark',
			buttonName: 'ESGST Bookmarked Giveaways',
			isNotification: true,
			side: 'left',
		});

		button.nodes.outer.classList.add('esgst-hidden');
		button.nodes.buttonIcon.title = getFeatureTooltip('gb', 'View your bookmarked giveaways');

		// noinspection JSIgnoredPromiseFromCall
		this.gb_addButton(button);

		if (Settings.get('gb_ue') && this.esgst.enterGiveawayButton) {
			this.esgst.enterGiveawayButton.onclick = () => {
				let giveaway = this.esgst.scopes.main.giveaways[0];
				if (giveaway && giveaway.gbButton) {
					if (giveaway.gbButton.index === 3) {
						// noinspection JSIgnoredPromiseFromCall
						giveaway.gbButton.change(giveaway.gbButton.callbacks[2]);
					}
					if (!Settings.get('gb_se')) {
						giveaway.gbButton.button.classList.add('esgst-hidden');
					}
				}
			};
		}
		if (this.esgst.leaveGiveawayButton) {
			this.esgst.leaveGiveawayButton.onclick = () => {
				let giveaway = this.esgst.scopes.main.giveaways[0];
				if (giveaway && giveaway.gbButton) {
					giveaway.gbButton.button.classList.remove('esgst-hidden');
				}
			};
		}
	}

	gb_addButton(button) {
		let i, n;
		let bookmarked = [],
			endingSoon = 1,
			started = 0,
			ending = 0;
		if (Settings.get('gb_h') && button) {
			button.nodes.outer.classList.add('esgst-gb-highlighted');
		}
		const toSave = {};
		for (let key in this.esgst.giveaways) {
			if (key.length > 5) {
				continue;
			}
			if (this.esgst.giveaways.hasOwnProperty(key)) {
				const giveaway = this.esgst.giveaways[key];
				if (giveaway.bookmarked) {
					if (typeof giveaway.started === 'undefined') {
						giveaway.started = true;
						toSave[key] = { started: true };
					}
					if (Date.now() >= giveaway.endTime || !giveaway.endTime) {
						if (giveaway.started) {
							if (Settings.get('gb_u')) {
								delete giveaway.bookmarked;
								toSave[key] = { bookmarked: null };
							} else {
								bookmarked.push(giveaway);
							}
						} else {
							bookmarked.push(giveaway);
							++started;
							if (Settings.get('gb_h') && button) {
								button.nodes.outer.classList.add('started');
							}
						}
					} else {
						bookmarked.push(giveaway);
						if (giveaway.started) {
							endingSoon = giveaway.endTime - Date.now() - Settings.get('gb_hours') * 3600000;
							if (endingSoon <= 0) {
								++ending;
							}
						}
					}
				}
			}
		}
		common.lock_and_save_giveaways(toSave);
		let title;
		if (started || ending) {
			if (started) {
				if (ending) {
					title = `(${started} started - click to update them, ${ending} ending)`;
				} else {
					title = `(${started} started - click to update them)`;
				}
			} else {
				title = `(${ending} ending)`;
			}
		} else {
			title = '';
		}
		if (button) {
			button.nodes.buttonIcon.title = getFeatureTooltip(
				'gb',
				`View your bookmarked giveaways ${title}`
			);
		}
		if (bookmarked.length) {
			bookmarked.sort((a, b) => {
				if (a.endTime > b.endTime) {
					return 1;
				} else if (a.endTime < b.endTime) {
					return -1;
				} else {
					return 0;
				}
			});
			for (i = 0, n = bookmarked.length; i < n; ++i) {
				if (Date.now() > bookmarked[i].endTime) {
					bookmarked.push(bookmarked.splice(i, 1)[0]);
					i -= 1;
					n -= 1;
				}
			}
			if (button) {
				button.nodes.outer.classList.remove('esgst-hidden');
				if (Settings.get('gb_h') && ending > 0) {
					button.nodes.outer.classList.add('ending');
				}
			}
		}
		if (Shared.common.isCurrentPath('Account') && this.esgst.parameters.esgst === 'gb') {
			const context = this.esgst.sidebar.nextElementSibling;
			if (Settings.get('removeSidebarInFeaturePages')) {
				this.esgst.sidebar.remove();
			}
			context.innerHTML = '';
			context.setAttribute('data-esgst-popup', 'true');
			this.heading = PageHeading.create('gb', [
				{
					name: 'ESGST',
					url: this.esgst.settingsUrl,
				},
				{
					name: 'Bookmarked Giveaways',
					url: `https://www.steamgifts.com/account/settings/profile?esgst=gb`,
				},
			]).insert(context, 'beforeend');
			this.gb_loadGibs(
				bookmarked,
				context,
				createElements(context, 'beforeend', [
					{
						type: 'div',
					},
				])
			);
		}
		if (button) {
			button.nodes.outer.addEventListener('click', () => {
				if (Settings.get('gb_t')) {
					Tabs.open(`https://www.steamgifts.com/account/settings/profile?esgst=gb`);
				} else {
					const popup = new Popup({
						addScrollable: 'left',
						isTemp: true,
					});
					this.heading = PageHeading.create('gb', [
						{
							name: 'ESGST',
							url: this.esgst.settingsUrl,
						},
						{
							name: 'Bookmarked Giveaways',
							url: `https://www.steamgifts.com/account/settings/profile?esgst=gb`,
						},
					]).insert(popup.description, 'afterbegin');
					this.gb_loadGibs(bookmarked, popup.description, popup.scrollable, popup);
				}
			});
		}
	}

	gb_loadGibs(bookmarked, container, context, popup) {
		let info;
		let i = 0;
		let n = bookmarked.length;
		let gbGiveaways = createElements(context, 'beforeend', [
			{
				attributes: {
					class: 'esgst-text-left',
				},
				type: 'div',
			},
		]);
		if (Settings.get('gas') || (Settings.get('gf') && Settings.get('gf_m')) || Settings.get('mm')) {
			if (Settings.get('gas')) {
				this.esgst.modules.giveawaysGiveawaysSorter.init(this.heading.nodes.outer);
			}
			if (Settings.get('gf') && Settings.get('gf_m')) {
				this.heading.nodes.outer.appendChild(
					this.esgst.modules.giveawaysGiveawayFilters.filters_addContainer(
						this.heading.nodes.outer,
						'Gb'
					)
				);
			}
			if (Settings.get('mm')) {
				this.esgst.modules.generalMultiManager.mm(this.heading.nodes.outer);
			}
		}
		ButtonComponent.create({
			color: 'white',
			icons: ['fa-list'],
			name: 'View Raw List',
			onClick: this.gb_openList.bind(this, { bookmarked }),
		}).insert(this.heading.nodes.outer, 'beforeend');
		const loadMoreButton = ButtonComponent.create([
			{
				color: 'green',
				icons: ['fa-plus'],
				name: 'Load more...',
				onClick: () => {
					return new Promise((resolve) => {
						// noinspection JSIgnoredPromiseFromCall
						this.gb_loadGiveaways(i, i + 5, bookmarked, gbGiveaways, info, popup, (value) => {
							i = value;
							if (i > n) {
								loadMoreButton.destroy();
							} else if (Settings.get('es_gb') && context.scrollHeight <= context.offsetHeight) {
								loadMoreButton.onClick(true);
							}
							resolve();
						});
					});
				},
			},
			{
				template: 'loading',
				isDisabled: true,
				name: 'Loading more...',
			},
		]).insert(this.heading.nodes.outer, 'beforeend');
		if (popup) {
			popup.open();
		}
		info = createElements(context, 'beforebegin', [
			{
				type: 'div',
				children: [
					{
						text: '0',
						type: 'span',
					},
					{
						text: 'P required to enter all ',
						type: 'node',
					},
					{
						text: '0',
						type: 'span',
					},
					{
						text: ' giveaways.',
						type: 'node',
					},
				],
			},
		]);
		loadMoreButton.onClick();
		if (Settings.get('es_gb')) {
			context.addEventListener('scroll', () => {
				if (
					context.scrollTop + context.offsetHeight >= context.scrollHeight &&
					!loadMoreButton.isBusy
				) {
					loadMoreButton.onClick();
				}
			});
		}
	}

	gb_openList(gb) {
		if (gb.popup) {
			gb.popup.open();
			return;
		}
		gb.popup = new Popup({
			addScrollable: true,
			icon: 'fa-list',
			title: `Bookmarked Giveaways (Raw List)`,
		});
		for (const giveaway of gb.bookmarked) {
			const attributes = {
				class: 'table__column__secondary-link',
				href: `/giveaway/${giveaway.code}/`,
			};
			if (giveaway.name) {
				attributes['data-esgst'] = true;
			}
			createElements(gb.popup.scrollable, 'beforeend', [
				{
					type: 'div',
					children: [
						{
							attributes,
							text: giveaway.name || giveaway.code,
							type: 'a',
						},
					],
				},
			]);
		}
		gb.popup.open();
		// noinspection JSIgnoredPromiseFromCall
		this.gb_loadNames(gb);
	}

	async gb_loadNames(gb) {
		let giveaways = {};
		for (let i = 0, n = gb.popup.scrollable.children.length; i < n; i++) {
			let element = gb.popup.scrollable.children[i].firstElementChild;
			if (!element.getAttribute('data-esgst')) {
				let code = element.textContent;
				element.textContent = DOM.parse(
					(
						await request({
							method: 'GET',
							queue: true,
							url: element.getAttribute('href'),
						})
					).responseText
				).getElementsByClassName('featured__heading__medium')[0].textContent;
				giveaways[code] = {
					name: element.textContent,
				};
			}
		}
		lockAndSaveGiveaways(giveaways);
	}

	async gb_loadGiveaways(i, n, bookmarked, gbGiveaways, info, popup, callback) {
		if (i < n) {
			if (bookmarked[i]) {
				let response = await request({
					method: 'GET',
					queue: true,
					url: `/giveaway/${bookmarked[i].code}/`,
				});
				let endTime;
				let responseHtml = DOM.parse(response.responseText);
				let url = response.finalUrl;
				const buildResult = await Shared.common.buildGiveaway(responseHtml, url);
				if (buildResult) {
					endTime = 0;
					if (!bookmarked[i].started && buildResult.started) {
						endTime = buildResult.timestamp;
					}
					info.firstElementChild.textContent =
						parseInt(info.firstElementChild.textContent) + buildResult.points;
					info.lastElementChild.textContent = parseInt(info.lastElementChild.textContent) + 1;
					if (
						Date.now() > bookmarked[i].endTime &&
						!gbGiveaways.getElementsByClassName('row-spacer')[0]
					) {
						DOM.insert(gbGiveaways, 'beforeend', <div className="row-spacer"></div>);
					}
					createElements(gbGiveaways, 'beforeend', buildResult.html);
					await endless_load(gbGiveaways.lastElementChild, false, 'gb');
					if (endTime > 0) {
						let deleteLock = await createLock('giveawayLock', 300);
						let giveaways = JSON.parse(getValue('giveaways'));
						giveaways[bookmarked[i].code].started = true;
						giveaways[bookmarked[i].code].endTime = endTime;
						await setValue('giveaways', JSON.stringify(giveaways));
						deleteLock();
						window.setTimeout(
							() => this.gb_loadGiveaways(++i, n, bookmarked, gbGiveaways, info, popup, callback),
							0
						);
					} else {
						window.setTimeout(
							() => this.gb_loadGiveaways(++i, n, bookmarked, gbGiveaways, info, popup, callback),
							0
						);
					}
				} else {
					if (Settings.get('gb_ui')) {
						let deleteLock = await createLock('giveawayLock', 300);
						let giveaways = JSON.parse(getValue('giveaways'));
						if (giveaways[bookmarked[i].code]) {
							delete giveaways[bookmarked[i].code].bookmarked;
						}
						await setValue('giveaways', JSON.stringify(giveaways));
						deleteLock();
					}
					window.setTimeout(
						() => this.gb_loadGiveaways(++i, n, bookmarked, gbGiveaways, info, popup, callback),
						0
					);
				}
			} else {
				callback(i + 1);
			}
		} else {
			callback(i);
		}
	}

	gb_getGiveaways(giveaways, main) {
		giveaways.forEach((giveaway) => {
			if (main && this.esgst.wonPath) return;
			if (
				(!main || !this.esgst.archivePath) &&
				giveaway.creator !== Settings.get('username') &&
				giveaway.code &&
				giveaway.code.length === 5 &&
				giveaway.url &&
				!giveaway.gbButton
			) {
				giveaway.bookmarked =
					this.esgst.giveaways[giveaway.code] && this.esgst.giveaways[giveaway.code].bookmarked;
				giveaway.gbButton = new Button(giveaway.headingName, 'beforebegin', {
					callbacks: [
						this.gb_bookmarkGiveaway.bind(this, giveaway, main),
						null,
						this.gb_unbookmarkGiveaway.bind(this, giveaway, main),
						null,
					],
					className: 'esgst-gb-button',
					icons: [
						'fa-bookmark-o esgst-clickable',
						'fa-circle-o-notch fa-spin',
						'fa-bookmark',
						'fa-circle-o-notch fa-spin',
					],
					id: 'gb',
					index: giveaway.bookmarked ? 2 : 0,
					titles: [
						'Bookmark giveaway',
						'Bookmarking giveaway...',
						'Unbookmark giveaway',
						'Unbookmarking giveaway...',
					],
				});
				giveaway.gbButton.button.setAttribute('data-draggable-id', 'gb');
				if ((giveaway.entered || (this.esgst.enteredPath && main)) && !Settings.get('gb_se')) {
					giveaway.gbButton.button.classList.add('esgst-hidden');
				}
			}
		});
	}

	async gb_bookmarkGiveaway(giveaway) {
		let deleteLock = await createLock('giveawayLock', 300);
		let giveaways = JSON.parse(getValue('giveaways', '{}'));
		if (!giveaways[giveaway.code]) {
			giveaways[giveaway.code] = {};
		}
		giveaways[giveaway.code].code = giveaway.code;
		giveaways[giveaway.code].endTime = giveaway.endTime;
		giveaways[giveaway.code].name = giveaway.name;
		giveaways[giveaway.code].started = giveaway.started;
		giveaways[giveaway.code].bookmarked = true;
		giveaway.bookmarked = true;
		await setValue('giveaways', JSON.stringify(giveaways));
		deleteLock();
		return true;
	}

	async gb_unbookmarkGiveaway(giveaway) {
		let deleteLock = await createLock('giveawayLock', 300);
		let giveaways = JSON.parse(getValue('giveaways', '{}'));
		if (giveaways[giveaway.code]) {
			delete giveaways[giveaway.code].bookmarked;
		}
		delete giveaway.bookmarked;
		await setValue('giveaways', JSON.stringify(giveaways));
		deleteLock();
		return true;
	}
}

const giveawaysGiveawayBookmarks = new GiveawaysGiveawayBookmarks();

export { giveawaysGiveawayBookmarks };
