import { DOM } from '../../class/DOM';
import { Logger } from '../../class/Logger';
import { Module } from '../../class/Module';
import { Popout } from '../../class/Popout';
import { Popup } from '../../class/Popup';
import { Session } from '../../class/Session';
import { Settings } from '../../class/Settings';
import { Shared } from '../../class/Shared';
import { Table } from '../../class/Table';
import { ToggleSwitch } from '../../class/ToggleSwitch';
import { Button } from '../../components/Button';
import { NotificationBar } from '../../components/NotificationBar';
import { PageHeading } from '../../components/PageHeading';
import { Utils } from '../../lib/jsUtils';
import { common } from '../Common';

const createElements = common.createElements.bind(common),
	createHeadingButton = common.createHeadingButton.bind(common),
	createResults = common.createResults.bind(common),
	getFeatureNumber = common.getFeatureNumber.bind(common),
	getFeatureTooltip = common.getFeatureTooltip.bind(common),
	getTimestamp = common.getTimestamp.bind(common),
	getUser = common.getUser.bind(common),
	getUserId = common.getUserId.bind(common),
	getValue = common.getValue.bind(common),
	observeNumChange = common.observeNumChange.bind(common),
	request = common.request.bind(common),
	saveUser = common.saveUser.bind(common);
class UsersWhitelistBlacklistChecker extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Adds a button (<i className="fa fa-heart"></i> <i className="fa fa-ban"></i>{' '}
						<i className="fa fa-question-circle"></i>) to the main page heading of any page that
						allows you to check which users in the page have whitelisted/blacklisted you.
					</li>
					<li>
						That information is retrieved by searching for whitelist giveaways in the user's{' '}
						<a href="https://www.steamgifts.com/user/cg">profile</a> page and checking if you can
						access them. If no whitelist giveaways are found, the feature searches for group +
						whitelist giveaways instead and checks if you can access them using the groups that you
						are a member of to determine whether you can access them for being a group member or for
						being in the user's whitelist.
					</li>
					<li>
						There are many options that allow you to narrow down the check: you can select which
						users to check, check only if the user has blacklisted you (which is faster than
						checking if they have whitelisted you because it does not need to find a whitelist
						giveaway), how many pages to check, whether or not to check again users that were
						already checked and whether or not to skip users that the feature is taking too long to
						find whitelist giveaways from.
					</li>
					<li>
						There are also options to return whitelists/blacklists, which means that if a user that
						has whitelisted/blacklisted you is found, they will be whitelisted/blacklisted back.
					</li>
					<li>
						Adds a button (<i className="fa fa-heart"></i> <i className="fa fa-ban"></i>{' '}
						<i className="fa fa-gear"></i>) to the page heading of this menu that allows you to
						view/update all of the users that have been checked.
					</li>
					<li>
						Results are cached for 24 hours, so if you check the same user again within that
						timeframe, their status will not change, unless you check them with the option to clear
						the cache enabled.
					</li>
				</ul>
			),
			features: {
				wbc_h: {
					description: () => (
						<ul>
							<li>
								Adds an icon (<i className="fa fa-check esgst-whitelist"></i> if the user has
								whitelisted you and <i className="fa fa-times esgst-blacklist"></i> if they have
								blacklisted you) next to a checked user's username (in any page).
							</li>
							<li>
								If you hover over the icon, it shows the date when they were checked for the last
								time.
							</li>
						</ul>
					),
					name: 'Highlight checked users.',
					sg: true,
					st: true,
				},
				wbc_n: {
					description: () => (
						<ul>
							<li>
								If you have <span data-esgst-feature-id="un"></span> enabled, a note will be saved
								for a user if they were whitelisted / blacklisted back.
							</li>
						</ul>
					),
					name: 'Save automatic notes when returning whitelists/blacklists.',
					sg: true,
				},
				wbc_hb: {
					description: () => (
						<ul>
							<li>
								With this option enabled, the feature will not tell you if a user has blacklisted
								you (in fact, the name of the feature will change to Whitelist Checker for you). If
								the feature finds a user that has blacklisted you, it will tell you that it could
								not determine their status.
							</li>
						</ul>
					),
					name: 'Hide blacklist information.',
					sg: true,
				},
			},
			id: 'wbc',
			name: 'Whitelist/Blacklist Checker',
			sg: true,
			sync: 'Steam Groups',
			syncKeys: ['Groups'],
			type: 'users',
		};
	}

	init() {
		if (Settings.get('wbc_h')) {
			Shared.esgst.userFeatures.push(this.wbc_users.bind(this));
		}
		if (!Shared.esgst.mainPageHeading) return;
		let [icons, title] = !Settings.get('wbc_hb')
			? [['fa-heart', 'fa-ban', 'fa-question-circle'], 'Check for whitelists/blacklists']
			: [['fa-heart', 'fa-question-circle'], 'Check for whitelists'];
		Shared.esgst.wbcButton = createHeadingButton({ id: 'wbc', icons, title });
		this.wbc_addButton(true, Shared.esgst.wbcButton);
	}

	wbc_users(users) {
		for (const user of users) {
			if (
				user.saved &&
				user.saved.wbc &&
				!user.context.parentElement.getElementsByClassName('esgst-wbc-icon')[0]
			) {
				let result = user.saved.wbc.result;
				if (result === 'whitelisted' || (result === 'blacklisted' && !Settings.get('wbc_hb'))) {
					createElements(user.context, 'beforebegin', [
						{
							attributes: {
								class: 'esgst-wbc-icon esgst-user-icon',
								title: getFeatureTooltip(
									'wbc',
									`${user.username} has ${result} you (last checked ${getTimestamp(
										user.saved.wbc.lastCheck
									)})`
								),
							},
							type: 'span',
							children: [
								{
									attributes: {
										class: `fa ${
											result === 'whitelisted'
												? 'fa-check esgst-whitelist'
												: 'fa-times esgst-blacklist'
										}`,
									},
									type: 'i',
								},
							],
						},
					]);
				}
			}
		}
	}

	wbc_addButton(Context, WBCButton) {
		let checkAllSwitch, checkPagesSwitch, checkSingleSwitch, popup;

		let WBC = {};
		WBC.Update = !Context;
		WBC.B = !Settings.get('wbc_hb');
		WBC.Username = Settings.get('username');
		popup = new Popup({
			addScrollable: true,
		});
		if (window.location.pathname.match(new RegExp(`^/user/(?!${WBC.Username})`))) {
			WBC.User = {
				Username: document.getElementsByClassName('featured__heading__medium')[0].textContent,
				ID: document.querySelector(`[name="child_user_id"]`).value,
				SteamID64: document.querySelector(`a[href*="/profiles/"]`).href.match(/\d+/)[0],
			};
		}

		let optionsButton;

		this.heading = PageHeading.create('wbc', [
			WBC.Update
				? 'Manage Whitelist/Blacklist Checker caches'
				: `Check for whitelists${WBC.B ? '/blacklists' : ''}`,
		]).insert(popup.description, 'beforeend');
		optionsButton = Button.create({
			color: 'alternate-white',
			tooltip: 'Options',
			icons: ['fa-gear'],
		}).insert(this.heading.nodes.outer, 'beforeend');

		const popout = new Popout('', optionsButton.nodes.outer, 0, true);

		popup.Options = createElements(popout.popout, 'beforeend', [{ type: 'div' }]);
		if (WBC.User) {
			checkSingleSwitch = new ToggleSwitch(
				popup.Options,
				'wbc_checkSingle',
				false,
				`Only check ${WBC.User ? WBC.User.Username : 'current user'}.`,
				false,
				false,
				`If disabled, all users in the current page will be checked.`,
				Settings.get('wbc_checkSingle')
			);
		}
		let feat = getFeatureNumber('mm');
		let checkSelectedSwitch = new ToggleSwitch(
			popup.Options,
			'wbc_checkSelected',
			false,
			'Only check selected.',
			false,
			false,
			`Use ${feat.number} ${feat.name} to select the users that you want to check. Then click the button 'Check WL/BL' in the Multi-Manager popout and you will be redirected here.`,
			Settings.get('wbc_checkSelected')
		);
		let checkFromListSwitch = new ToggleSwitch(
			popup.Options,
			'wbc_checkFromList',
			false,
			(
				<fragment>
					Only check these users:{' '}
					<input
						className="esgst-switch-input esgst-switch-input-large"
						placeholder="user1, user2, user3, ..."
						type="text"
						value={Settings.get('wbc_userList').join(', ')}
						onchange={(event) => {
							Settings.set('wbc_userList', Array.from(new Set(event.target.value.split(/,\s*/))));
							Shared.common.setSetting('wbc_userList', Settings.get('wbc_userList'));
						}}
					/>
				</fragment>
			),
			false,
			false,
			'Enter the usernames of the users that you want to check, separated by a comma.',
			Settings.get('wbc_checkFromList')
		);
		if (WBC.B) {
			new ToggleSwitch(
				popup.Options,
				'wbc_checkBlacklist',
				false,
				'Only check blacklist.',
				false,
				false,
				`If enabled, a blacklist-only check will be performed (faster).`,
				Settings.get('wbc_checkBlacklist')
			);
		}
		if (!WBC.Update && !window.location.pathname.match(/^\/(discussions|users|archive)/)) {
			checkAllSwitch = new ToggleSwitch(
				popup.Options,
				'wbc_checkAll',
				false,
				'Check all pages.',
				false,
				false,
				`If disabled, only the current page will be checked.`,
				Settings.get('wbc_checkAll')
			);
			checkPagesSwitch = new ToggleSwitch(
				popup.Options,
				'wbc_checkPages',
				false,
				(
					<fragment>
						Check only pages from{' '}
						<input
							className="esgst-switch-input"
							min="1"
							type="number"
							value={Settings.get('wbc_minPage')}
						/>
						{' to '}
						<input
							className="esgst-switch-input"
							min="1"
							type="number"
							value={Settings.get('wbc_maxPage')}
						/>
						.
					</fragment>
				),
				false,
				false,
				null,
				Settings.get('wbc_checkPages')
			);
			let minPage = checkPagesSwitch.name.firstElementChild;
			let maxPage = minPage.nextElementSibling;
			let lastPage = Shared.esgst.modules.generalLastPageLink.lpl_getLastPage(document, true);
			if (lastPage !== 999999999) {
				maxPage.setAttribute('max', lastPage);
			}
			observeNumChange(minPage, 'wbc_minPage', true);
			observeNumChange(maxPage, 'wbc_maxPage', true);
		}
		new ToggleSwitch(
			popup.Options,
			'wbc_returnWhitelists',
			false,
			'Return whitelists.',
			false,
			false,
			`If enabled, everyone who has whitelisted you will be whitelisted back.`,
			Settings.get('wbc_returnWhitelists')
		);
		if (WBC.B) {
			new ToggleSwitch(
				popup.Options,
				'wbc_returnBlacklists',
				false,
				'Return blacklists.',
				false,
				false,
				`If enabled, everyone who has blacklisted you will be blacklisted back.`,
				Settings.get('wbc_returnBlacklists')
			);
		}
		new ToggleSwitch(
			popup.Options,
			'wbc_checkNew',
			false,
			`Only check users who have not whitelisted ${WBC.B ? '/blacklisted' : ''} you.`,
			false,
			false,
			`If enabled, everyone who has whitelisted ${
				WBC.B ? '/blacklisted' : ''
			} you will be ignored (might lead to outdated data if someone who had whitelisted ${
				WBC.B ? '/blacklisted' : ''
			} you in the past removed you from those lists).`,
			Settings.get('wbc_checkNew')
		);
		observeNumChange(
			new ToggleSwitch(
				popup.Options,
				'wbc_skipUsers',
				false,
				(
					<fragment>
						Skip users after{' '}
						<input
							className="esgst-ugs-difference"
							type="number"
							value={Settings.get('wbc_pages')}
						/>{' '}
						pages.
					</fragment>
				),
				false,
				false,
				`If enabled, when a user check passes the number of pages specified, the user will be skipped.`,
				Settings.get('wbc_skipUsers')
			).name.firstElementChild,
			'wbc_pages',
			true
		);
		new ToggleSwitch(
			popup.Options,
			'wbc_clearCache',
			false,
			'Clear caches.',
			false,
			false,
			`If enabled, the caches of all checked users will be cleared (slower).`,
			Settings.get('wbc_clearCache')
		);
		if (checkSingleSwitch || checkAllSwitch || checkPagesSwitch) {
			if (checkSingleSwitch) {
				if (checkAllSwitch) {
					checkSingleSwitch.exclusions.push(checkAllSwitch.container);
				}
				if (checkPagesSwitch) {
					checkSingleSwitch.exclusions.push(checkPagesSwitch.container);
				}
				checkSingleSwitch.exclusions.push(checkSelectedSwitch.container);
				checkSingleSwitch.exclusions.push(checkFromListSwitch.container);
				checkSelectedSwitch.exclusions.push(checkSingleSwitch.container);
				checkFromListSwitch.exclusions.push(checkSingleSwitch.container);
				if (Settings.get('wbc_checkSingle')) {
					if (checkAllSwitch) {
						checkAllSwitch.container.classList.add('esgst-hidden');
					}
					if (checkPagesSwitch) {
						checkPagesSwitch.container.classList.add('esgst-hidden');
					}
					checkSelectedSwitch.container.classList.add('esgst-hidden');
					checkFromListSwitch.container.classList.add('esgst-hidden');
				} else if (Settings.get('wbc_checkSelected') || Settings.get('wbc_checkFromList')) {
					checkSingleSwitch.container.classList.add('esgst-hidden');
				}
			}
			if (checkAllSwitch) {
				if (checkSingleSwitch) {
					checkAllSwitch.exclusions.push(checkSingleSwitch.container);
				}
				if (checkPagesSwitch) {
					checkAllSwitch.exclusions.push(checkPagesSwitch.container);
				}
				checkSelectedSwitch.exclusions.push(checkAllSwitch.container);
				checkFromListSwitch.exclusions.push(checkAllSwitch.container);
				checkAllSwitch.exclusions.push(checkSelectedSwitch.container);
				checkAllSwitch.exclusions.push(checkFromListSwitch.container);
				if (Settings.get('wbc_checkAll')) {
					if (checkSingleSwitch) {
						checkSingleSwitch.container.classList.add('esgst-hidden');
					}
					if (checkPagesSwitch) {
						checkPagesSwitch.container.classList.add('esgst-hidden');
					}
					checkSelectedSwitch.container.classList.add('esgst-hidden');
					checkFromListSwitch.container.classList.add('esgst-hidden');
				} else if (Settings.get('wbc_checkSelected') || Settings.get('wbc_checkFromList')) {
					checkAllSwitch.container.classList.add('esgst-hidden');
				}
			}
			if (checkPagesSwitch) {
				if (checkSingleSwitch) {
					checkPagesSwitch.exclusions.push(checkSingleSwitch.container);
				}
				if (checkAllSwitch) {
					checkPagesSwitch.exclusions.push(checkAllSwitch.container);
				}
				checkSelectedSwitch.exclusions.push(checkPagesSwitch.container);
				checkFromListSwitch.exclusions.push(checkPagesSwitch.container);
				checkPagesSwitch.exclusions.push(checkSelectedSwitch.container);
				checkPagesSwitch.exclusions.push(checkFromListSwitch.container);
				if (Settings.get('wbc_checkPages')) {
					if (checkSingleSwitch) {
						checkSingleSwitch.container.classList.add('esgst-hidden');
					}
					if (checkAllSwitch) {
						checkAllSwitch.container.classList.add('esgst-hidden');
					}
					checkSelectedSwitch.container.classList.add('esgst-hidden');
					checkFromListSwitch.container.classList.add('esgst-hidden');
				} else if (Settings.get('wbc_checkSelected') || Settings.get('wbc_checkFromList')) {
					checkPagesSwitch.container.classList.add('esgst-hidden');
				}
			}
		}
		checkSelectedSwitch.exclusions.push(checkFromListSwitch.container);
		checkFromListSwitch.exclusions.push(checkSelectedSwitch.container);
		createElements(popup.Options, 'afterend', [
			{
				attributes: {
					class: 'esgst-description',
				},
				text: `If an user is highlighted, that means they have been either checked for the first time or updated.`,
				type: 'div',
			},
		]);
		Button.create([
			{
				color: 'green',
				icons: [WBC.Update ? 'fa-refresh' : 'fa-question-circle'],
				name: WBC.Update ? 'Update' : 'Check',
				onClick: () => {
					return new Promise((resolve) => {
						WBC.ShowResults = false;
						WBCButton.classList.add('esgst-busy');
						// noinspection JSIgnoredPromiseFromCall
						this.wbc_setCheck(WBC, () => {
							if (this.skip) {
								this.skip.destroy();
								this.skip = null;
							}
							WBC.progressBar.reset().hide();
							WBC.overallProgressBar.setSuccess();
							WBCButton.classList.remove('esgst-busy');
							resolve();
							WBC.popup.setDone();
						});
					});
				},
			},
			{
				template: 'error',
				name: 'Cancel',
				switchTo: { onReturn: 0 },
				onClick: () => {
					if (this.skip) {
						this.skip.destroy();
						this.skip = null;
					}
					window.clearInterval(WBC.Request);
					window.clearInterval(WBC.Save);
					WBC.Canceled = true;
					window.setTimeout(() => {
						WBC.progressBar.reset().hide();
					}, 500);
					WBCButton.classList.remove('esgst-busy');
				},
			},
		]).insert(this.heading.nodes.outer, 'beforeend');
		WBC.progressBar = NotificationBar.create().insert(popup.description, 'beforeend').hide();
		WBC.overallProgressBar = NotificationBar.create().insert(popup.description, 'beforeend').hide();
		popup.Results = createElements(popup.scrollable, 'beforeend', [{ type: 'div' }]);

		this.table = new Table([
			[
				{
					size: 'fill',
					value: (
						<fragment>
							<i className="fa fa-heart esgst-whitelist"></i>
							{' Whitelisted ('}
							<span ref={(ref) => (this.whitelistedCount = ref)}>0</span>
							{') '}
							<i className="fa fa-question-circle" title="Users that have whitelisted you"></i>
						</fragment>
					),
				},
				{
					size: 'fill',
					value: (
						<fragment>
							<i className="fa fa-ban esgst-blacklist"></i>
							{' Blacklisted ('}
							<span ref={(ref) => (this.blacklistedCount = ref)}>0</span>
							{') '}
							<i className="fa fa-question-circle" title="Users that have blacklisted you"></i>
						</fragment>
					),
				},
				{
					size: 'fill',
					value: (
						<fragment>
							<i className="fa fa-check"></i>
							{` ${WBC.B ? 'None' : 'Not Blacklisted'} (`}
							<span ref={(ref) => (this.noneCount = ref)}>0</span>
							{') '}
							<i
								className="fa fa-question-circle"
								title={
									WBC.B
										? 'Users that have neither whitelisted nor blacklisted you'
										: 'Users that have not whitelisted you'
								}
							></i>
						</fragment>
					),
				},
				{
					size: 'fill',
					value: (
						<fragment>
							<i className="fa fa-question"></i>
							{' Not Blacklisted ('}
							<span ref={(ref) => (this.notBlacklistedCount = ref)}>0</span>
							{') '}
							<i
								className="fa fa-question-circle"
								title="Users that have not blacklisted you, but there is not enough information to know if they have whitelisted you"
							></i>
						</fragment>
					),
				},
				{
					size: 'fill',
					value: (
						<fragment>
							<i className="fa fa-question"></i>
							{' Unknown ('}
							<span ref={(ref) => (this.unknownCount = ref)}>0</span>
							{') '}
							<i
								className="fa fa-question-circle"
								title={
									WBC.B
										? 'There is not enough information to know if these users have whitelisted or blacklisted you'
										: 'There is not enough information to know if these users have whitelisted you'
								}
							></i>
						</fragment>
					),
				},
				{
					size: 'fill',
					value: (
						<fragment>
							<i className="fa fa-times"></i>
							{' Not Found ('}
							<span ref={(ref) => (this.nonexistentCount = ref)}>0</span>
							{') '}
							<i
								className="fa fa-question-circle"
								title="These users were not found (most likely they changed usernames or deleted their account)"
							></i>
						</fragment>
					),
				},
			],
		]);

		if (!WBC.B) {
			this.table.hideColumns(2, 4);
		}

		this.table.table.style.minWidth = '1200px';

		popup.Results.appendChild(this.table.table);

		WBCButton.addEventListener('click', () => {
			if (WBCButton.getAttribute('data-mm')) {
				if (!Settings.get('wbc_checkSelected')) {
					if (Settings.get('wbc_checkSingle') && checkSingleSwitch) {
						let element = createElements(checkSingleSwitch.container, 'afterbegin', [
							{
								attributes: {
									class: 'esgst-bold esgst-red',
								},
								text: 'Disable this -->',
								type: 'span',
							},
						]);
						window.setTimeout(() => element.remove(), 5000);
					} else if (Settings.get('wbc_checkAll')) {
						let element = createElements(checkAllSwitch.container, 'afterbegin', [
							{
								attributes: {
									class: 'esgst-bold esgst-red',
								},
								text: 'Disable this -->',
								type: 'span',
							},
						]);
						window.setTimeout(() => element.remove(), 5000);
					} else if (Settings.get('wbc_checkPages')) {
						let element = createElements(checkPagesSwitch.container, 'afterbegin', [
							{
								attributes: {
									class: 'esgst-bold esgst-red',
								},
								text: 'Disable this -->',
								type: 'span',
							},
						]);
						window.setTimeout(() => element.remove(), 5000);
					}
					let element = createElements(checkSelectedSwitch.container, 'afterbegin', [
						{
							attributes: {
								class: 'esgst-bold esgst-red',
							},
							text: 'Enable this -->',
							type: 'span',
						},
					]);
					window.setTimeout(() => element.remove(), 5000);
				}
				WBCButton.removeAttribute('data-mm');
			}
			WBC.popup = popup;
			popup.open(() => {
				if (WBC.Update) {
					WBC.ShowResults = true;
					// noinspection JSIgnoredPromiseFromCall
					this.wbc_setCheck(WBC, () => {
						WBC.progressBar.reset().hide();
					});
				}
			});
		});
	}

	/**
	 * @param WBC
	 * @param [Callback]
	 * @returns {Promise<void>}
	 */
	async wbc_setCheck(WBC, Callback) {
		let SavedUsers, I, N;
		WBC.progressBar.setLoading(null).show();
		WBC.overallProgressBar.reset().show();

		this.whitelistedCount.textContent = '0';
		this.blacklistedCount.textContent = '0';
		this.noneCount.textContent = '0';
		this.notBlacklistedCount.textContent = '0';
		this.unknownCount.textContent = '0';
		this.nonexistentCount.textContent = '0';
		this.whitelistedRow = 0;
		this.whitelistedColumn = 0;
		this.blacklistedRow = 0;
		this.blacklistedColumn = 1;
		this.noneRow = 0;
		this.noneColumn = 2;
		this.notBlacklistedRow = 0;
		this.notBlacklistedColumn = 3;
		this.unknownRow = 0;
		this.unknownColumn = 4;
		this.nonexistentRow = 0;
		this.nonexistentColumn = 5;

		this.table.clear();

		WBC.Users = [];
		WBC.Canceled = false;
		if (WBC.Update) {
			SavedUsers = JSON.parse(getValue('users'));
			for (I in SavedUsers.users) {
				if (SavedUsers.users.hasOwnProperty(I)) {
					if (SavedUsers.users[I].wbc && SavedUsers.users[I].wbc.result) {
						WBC.Users.push(SavedUsers.users[I].username);
						if (!SavedUsers.users[I].username) {
							Logger.info(`Log for #1084: ${I}, ${JSON.stringify(SavedUsers.users[I])}`);
						}
					}
				}
			}
			WBC.Users = Utils.sortArray(WBC.Users);
			if (WBC.ShowResults) {
				for (I = 0, N = WBC.Users.length; I < N; ++I) {
					if (Utils.isSet(WBC.Users[I]) && !SavedUsers.users[SavedUsers.steamIds[WBC.Users[I]]]) {
						continue;
					}
					let user = {
						steamId: SavedUsers.steamIds[WBC.Users[I]],
						id: SavedUsers.users[SavedUsers.steamIds[WBC.Users[I]]].id,
						username: WBC.Users[I],
					};
					// noinspection JSIgnoredPromiseFromCall
					await this.wbc_setResult(
						WBC,
						user,
						SavedUsers.users[SavedUsers.steamIds[WBC.Users[I]]].wbc,
						SavedUsers.users[SavedUsers.steamIds[WBC.Users[I]]].notes,
						SavedUsers.users[SavedUsers.steamIds[WBC.Users[I]]].whitelisted,
						SavedUsers.users[SavedUsers.steamIds[WBC.Users[I]]].blacklisted,
						false
					);
				}
				Callback();
			} else {
				this.skip = Button.create({
					color: 'green',
					icons: ['fa-forward'],
					name: 'Skip User',
					onClick: () => {
						WBC.manualSkip = true;
					},
				}).insert(this.heading.nodes.outer, 'beforeend');

				// noinspection JSIgnoredPromiseFromCall
				this.wbc_checkUsers(WBC, 0, WBC.Users.length, Callback);
			}
		} else if (WBC.User && Settings.get('wbc_checkSingle')) {
			WBC.Users.push(WBC.User.Username);
			// noinspection JSIgnoredPromiseFromCall
			this.wbc_checkUsers(WBC, 0, 1, Callback);
		} else {
			if (Settings.get('wbc_checkFromList')) {
				WBC.Users = Settings.get('wbc_userList');
			} else if (Settings.get('wbc_checkSelected')) {
				WBC.Users = Array.from(Shared.esgst.mmWbcUsers);
			} else if (!Settings.get('wbc_checkPages')) {
				let elements = Shared.esgst.pageOuterWrap.querySelectorAll(`a[href*="/user/"]`);
				for (let element of elements) {
					let match = element.getAttribute('href').match(/\/user\/(.+)/);
					if (!match) continue;
					let username = match[1];
					if (
						WBC.Users.indexOf(username) > -1 ||
						username === Settings.get('username') ||
						username !== element.textContent ||
						element.closest('.markdown')
					)
						continue;
					WBC.Users.push(username);
				}
			}
			if (
				(Settings.get('wbc_checkAll') || Settings.get('wbc_checkPages')) &&
				((WBC.User && !Settings.get('wbc_checkSingle')) || !WBC.User) &&
				!WBC.Update &&
				!window.location.pathname.match(/^\/(discussions|users|archive)/)
			) {
				WBC.lastPage = Settings.get('wbc_checkPages') ? `of ${Settings.get('wbc_maxPage')}` : '';
				// noinspection JSIgnoredPromiseFromCall
				this.wbc_getUsers(
					WBC,
					Settings.get('wbc_checkPages') ? Settings.get('wbc_minPage') - 1 : 0,
					Shared.esgst.currentPage,
					Shared.esgst.searchUrl,
					() => {
						this.skip = Button.create({
							color: 'green',
							icons: ['fa-forward'],
							name: 'Skip User',
							onClick: () => {
								WBC.manualSkip = true;
							},
						}).insert(this.heading.nodes.outer, 'beforeend');

						WBC.Users = Utils.sortArray(WBC.Users);
						if (window.location.pathname.match(/^\/users/)) {
							WBC.Users = WBC.Users.slice(0, 25);
						}
						// noinspection JSIgnoredPromiseFromCall
						this.wbc_checkUsers(WBC, 0, WBC.Users.length, Callback);
					}
				);
			} else {
				this.skip = Button.create({
					color: 'green',
					icons: ['fa-forward'],
					name: 'Skip User',
					onClick: () => {
						WBC.manualSkip = true;
					},
				}).insert(this.heading.nodes.outer, 'beforeend');

				WBC.Users = Utils.sortArray(WBC.Users);
				if (window.location.pathname.match(/^\/users/)) {
					WBC.Users = WBC.Users.slice(0, 25);
				}
				// noinspection JSIgnoredPromiseFromCall
				this.wbc_checkUsers(WBC, 0, WBC.Users.length, Callback);
			}
		}
	}

	async wbc_checkUsers(WBC, I, N, Callback) {
		let User, Result;
		if (!WBC.Canceled) {
			WBC.overallProgressBar.setMessage(`${I} of ${N} users checked`);
			if (I < N) {
				User =
					WBC.User && Settings.get('wbc_checkSingle')
						? WBC.User
						: {
								Username: WBC.Users[I],
						  };
				let user = {
					steamId: User.SteamID64,
					id: User.ID,
					username: User.Username,
				};
				let notes, whitelisted, blacklisted, wbc;
				const savedUser = await getUser(null, user);
				if (savedUser) {
					notes = savedUser.notes;
					whitelisted = savedUser.whitelisted;
					blacklisted = savedUser.blacklisted;
					wbc = savedUser.wbc;
				}
				if (wbc && wbc.result) {
					Result = wbc.result;
				}
				if (WBC.manualSkip) {
					if (!wbc) {
						wbc = {};
					}
					window.setTimeout(
						() =>
							this.wbc_setResult(
								WBC,
								user,
								wbc,
								notes,
								whitelisted,
								blacklisted,
								Result !== wbc.result,
								I,
								N,
								Callback
							),
						0
					);
				} else if (!wbc || !Settings.get('wbc_checkNew')) {
					if (!wbc) {
						wbc = {};
					}
					await this.wbc_checkUser(wbc, WBC, user.username);
					window.setTimeout(
						() =>
							this.wbc_setResult(
								WBC,
								user,
								wbc,
								notes,
								whitelisted,
								blacklisted,
								Result !== wbc.result,
								I,
								N,
								Callback
							),
						0
					);
				} else {
					window.setTimeout(
						() =>
							this.wbc_setResult(
								WBC,
								user,
								wbc,
								notes,
								whitelisted,
								blacklisted,
								Result !== wbc.result,
								I,
								N,
								Callback
							),
						0
					);
				}
			} else if (Callback) {
				Callback();
			}
		}
	}

	async wbc_setResult(WBC, user, wbc, notes, whitelisted, blacklisted, New, I, N, Callback) {
		let Key;
		const isSkipped = WBC.manualSkip || WBC.autoSkip;
		WBC.manualSkip = false;
		WBC.autoSkip = false;
		if (!WBC.Canceled) {
			Key =
				(wbc.result === 'blacklisted' || wbc.result === 'notBlacklisted') && !WBC.B
					? 'unknown'
					: wbc.result;
			const attributes = {
				href: `/user/${user.username}`,
			};
			if (New) {
				attributes.className = 'esgst-bold esgst-italic';
			}
			let items = null;
			if (isSkipped && (wbc.result === 'unknown' || wbc.result === 'notBlacklisted')) {
				items = (
					<span>
						<a {...attributes}>{user.username}</a>{' '}
						<i
							className="fa fa-forward"
							title="This user was skipped, so there may actually be enough information available."
						></i>
					</span>
				);
			} else {
				items = (
					<div>
						<a {...attributes}>{user.username}</a>
						{wbc.wl_ga || wbc.g_wl_ga || wbc.ga ? (
							<fragment>
								{' '}
								<a href={`/giveaway/${wbc.wl_ga || wbc.g_wl_ga || wbc.ga}/`} target="_blank">
									<i className="fa fa-external-link" title="Confirm"></i>
								</a>
							</fragment>
						) : null}
					</div>
				);
			}

			this[`${Key}Count`].textContent = parseInt(this[`${Key}Count`].textContent) + 1;

			const cell = this.table.addCell(this[`${Key}Row`], this[`${Key}Column`], {
				size: 'fill',
				value: items,
			});

			await Shared.common.endless_load(cell);

			this[`${Key}Row`] += 1;

			if (!WBC.ShowResults) {
				if (
					(Settings.get('wbc_returnWhitelists') && wbc.result === 'whitelisted' && !whitelisted) ||
					(WBC.B &&
						Settings.get('wbc_returnBlacklists') &&
						wbc.result === 'blacklisted' &&
						!blacklisted)
				) {
					if (user.id) {
						// noinspection JSIgnoredPromiseFromCall
						this.wbc_returnWlBl(WBC, wbc, user.username, user.id, notes, async (success, notes) => {
							if (success) {
								user.values = {
									wbc: wbc,
									whitelisted: false,
									blacklisted: false,
								};
								if (notes) {
									user.values.notes = notes;
								}
								user.values[wbc.result] = true;
								user.values[`${wbc.result}Date`] = Date.now();
							}
							await saveUser(null, null, user);
							window.setTimeout(() => this.wbc_checkUsers(WBC, ++I, N, Callback), 0);
						});
					} else {
						await getUserId(user);
						// noinspection JSIgnoredPromiseFromCall
						this.wbc_returnWlBl(WBC, wbc, user.username, user.id, notes, async (success, notes) => {
							if (success) {
								user.values = {
									wbc: wbc,
									whitelisted: false,
									blacklisted: false,
								};
								if (notes) {
									user.values.notes = notes;
								}
								user.values[wbc.result] = true;
								user.values[`${wbc.result}Date`] = Date.now();
							}
							await saveUser(null, null, user);
							window.setTimeout(() => this.wbc_checkUsers(WBC, ++I, N, Callback), 0);
						});
					}
				} else if (
					wbc.result === 'whitelisted' ||
					wbc.result === 'blacklisted' ||
					whitelisted ||
					blacklisted
				) {
					user.values = {
						wbc: wbc,
					};
					await saveUser(null, null, user);
					window.setTimeout(() => this.wbc_checkUsers(WBC, ++I, N, Callback), 0);
				} else if (New) {
					user.values = {
						wbc: null,
					};
					await saveUser(null, null, user);
					window.setTimeout(() => this.wbc_checkUsers(WBC, ++I, N, Callback), 0);
				} else {
					window.setTimeout(() => this.wbc_checkUsers(WBC, ++I, N, Callback), 0);
				}
			}
		}
	}

	async wbc_returnWlBl(WBC, wbc, username, id, notes, Callback) {
		let Key, Type;
		if (!WBC.Canceled) {
			Key = wbc.result;
			Type = Key.match(/(.+)ed/)[1];
			WBC.progressBar.setMessage(`Returning ${Type} for ${username}...`);
			if (window.location.pathname.match(new RegExp(`^/user/${username}`))) {
				document.getElementsByClassName(`sidebar__shortcut__${Type}`)[0].click();
				if (Settings.get('wbc_n')) {
					let msg = `Returned ${Type}.`;
					if (notes) {
						notes = `${msg}\n\n${notes}`;
					} else {
						notes = msg;
					}
				}
				Callback(true, notes);
			} else {
				let success = false;
				if (
					JSON.parse(
						(
							await request({
								data: `xsrf_token=${Session.xsrfToken}&do=${Type}&child_user_id=${id}&action=insert`,
								method: 'POST',
								queue: true,
								url: '/ajax.php',
							})
						).responseText
					).type === 'success'
				) {
					success = true;
					if (Settings.get('wbc_n')) {
						let msg = `${Key} in return.`;
						if (notes) {
							notes = `${msg}\n\n${notes}`;
						} else {
							notes = msg;
						}
					}
				}
				Callback(success, notes);
			}
		}
	}

	async wbc_checkUser(data, obj, username) {
		if (obj.Canceled || obj.manualSkip) {
			return;
		}
		if (Settings.get('wbc_clearCache')) {
			for (const key in data) {
				if (data.hasOwnProperty(key)) {
					delete data[key];
				}
			}
		}
		if (!data.lastCheck) {
			data.lastCheck = 0;
		}
		if (!data.timestamp) {
			data.timestamp = 0;
		}
		if (data.giveaway) {
			const match = data.giveaway.match(/\/giveaway\/(.+?)\//);
			if (match) {
				delete data.giveaway;
				data.ga = match[1];
			}
		}
		if (data.whitelistGiveaway) {
			const match = data.whitelistGiveaway.match(/\/giveaway\/(.+?)\//);
			if (match) {
				delete data.whitelistGiveaway;
				data.wl_ga = match[1];
			}
		}
		if (data.groupGiveaways) {
			for (const key in data.groupGiveaways) {
				const match = key.match(/^(.+?)\//);
				if (match) {
					if (!data.g_wl_gas) {
						data.g_wl_gas = {};
					}
					data.g_wl_gas[match[1]] = data.groupGiveaways[key];
					delete data.groupGiveaways[key];
				}
			}
			if (Object.keys(data.groupGiveaways).length === 0) {
				delete data.groupGiveaways;
			}
		}
		if (Date.now() - data.lastCheck <= 86400000 && !obj.Update) {
			return;
		}
		if (
			((!Settings.get('wbc_checkBlacklist') || !obj.B) && (data.wl_ga || data.g_wl_ga)) ||
			(Settings.get('wbc_checkBlacklist') && obj.B && data.ga)
		) {
			obj.Timestamp = data.timestamp;
			await this.wbc_checkGiveaway(data, obj, username, true);
		} else {
			obj.Timestamp = 0;
			const match = Shared.esgst.locationHref.match(
				new RegExp(`/user/${username}(/search?page=(\\d+))?`)
			);
			await this.wbc_getGiveaways(
				match ? (match[2] ? parseInt(match[2]) : 1) : 0,
				data,
				obj,
				username
			);
		}
	}

	async wbc_checkGiveaway(data, obj, username, cached) {
		if (obj.Canceled) {
			return;
		}
		let responseHtml = DOM.parse(
			(
				await request({
					method: 'GET',
					queue: true,
					url: `/giveaway/${data.wl_ga || data.g_wl_ga || data.ga}/`,
				})
			).responseText
		);
		let errorMessage = responseHtml.getElementsByClassName('table--summary')[0];
		let stop;
		if (errorMessage) {
			errorMessage = errorMessage.textContent;
			if (errorMessage.match(/blacklisted the giveaway creator/)) {
				data.result = 'notBlacklisted';
				stop = true;
			} else if (errorMessage.match(/blacklisted by the giveaway creator/)) {
				data.result = 'blacklisted';
			} else if (errorMessage.match(/not a member of the giveaway creator's whitelist/)) {
				data.result = 'none';
			} else {
				data.result = 'notBlacklisted';
			}
			data.lastCheck = Date.now();
			data.timestamp = obj.Timestamp;
		} else if (data.wl_ga) {
			data.result = 'whitelisted';
			data.lastCheck = Date.now();
			data.timestamp = obj.Timestamp;
		} else if (data.g_wl_ga) {
			let found, groups, i, j, n;
			found = false;
			groups = JSON.parse(getValue('groups', '[]'));
			for (i = 0, n = data.g_wl_gas[data.g_wl_ga].length; i < n && !found; ++i) {
				for (
					j = groups.length - 1;
					j > -1 && groups[j].code !== data.g_wl_gas[data.g_wl_ga][i];
					--j
				) {}
				if (j > -1 && groups[j].member) {
					found = true;
				}
			}
			if (found) {
				if (cached) {
					data.result = 'notBlacklisted';
					data.lastCheck = Date.now();
					data.timestamp = obj.Timestamp;
				} else {
					obj.Timestamp = 0;
					obj.GroupGiveaways = [];
					let match = Shared.esgst.locationHref.match(
						new RegExp(`/user/${username}(/search?page=(\\d+))?`)
					);
					await this.wbc_getGiveaways(
						match ? (match[2] ? parseInt(match[2]) : 1) : 0,
						data,
						obj,
						username
					);
				}
			} else {
				data.result = 'whitelisted';
				data.lastCheck = Date.now();
				data.timestamp = obj.Timestamp;
			}
		} else {
			data.result = 'notBlacklisted';
			data.lastCheck = Date.now();
			data.timestamp = obj.Timestamp;
		}
		return stop;
	}

	async wbc_getGiveaways(currentPage, data, obj, username) {
		if (obj.Canceled) {
			return;
		}

		let isStopped = false;
		let nextPage = 1;
		let pagination = null;
		const url = `/user/${username}/search?page=`;
		do {
			let context = null;
			if (currentPage === nextPage) {
				context = document;
			} else {
				const response = await request({
					method: 'GET',
					queue: true,
					url: `${url}${nextPage}`,
				});
				if (response.finalUrl.match(/\/user\//)) {
					context = DOM.parse(response.responseText);
				} else {
					isStopped = true;
					break;
				}
			}
			if (nextPage === 1) {
				obj.lastPage = Shared.esgst.modules.generalLastPageLink.lpl_getLastPage(
					context,
					context === document,
					false,
					true
				);
				obj.lastPage = obj.lastPage === 999999999 ? '' : ` of ${obj.lastPage}`;
			}
			obj.progressBar.setMessage(
				`Retrieving ${username}'s giveaways (page ${nextPage}${obj.lastPage})...`
			);
			if (!data.ga) {
				const element = context.querySelector(
					`[class*="giveaway__heading__name"][href*="/giveaway/"]`
				);
				data.ga = element ? element.getAttribute('href').match(/\/giveaway\/(.+?)\//)[1] : null;
			}
			const giveaway = context.getElementsByClassName('giveaway__summary')[0];
			if (giveaway && obj.Timestamp === 0) {
				obj.Timestamp =
					parseInt(
						giveaway
							.querySelector(`.giveaway__columns span[data-timestamp]`)
							.getAttribute('data-timestamp')
					) * 1e3;
				if (obj.Timestamp >= Date.now()) {
					obj.Timestamp = 0;
				}
			}
			let doStop = false;
			if (data.ga) {
				doStop = await this.wbc_checkGiveaway(data, obj, username);
				if (
					data.result !== 'notBlacklisted' ||
					doStop ||
					(Settings.get('wbc_checkBlacklist') && obj.B)
				) {
					break;
				}
			}
			let groupGiveaways = [];
			const elements = context.getElementsByClassName('giveaway__column--whitelist');
			doStop = false;
			for (const element of elements) {
				const groupElement = element.parentElement.getElementsByClassName(
					'giveaway__column--group'
				)[0];
				if (groupElement) {
					groupGiveaways.push(groupElement.getAttribute('href').match(/\/giveaway\/(.+?)\//)[1]);
				} else {
					data.wl_ga = element
						.closest('.giveaway__summary')
						.getElementsByClassName('giveaway__heading__name')[0]
						.getAttribute('href')
						.match(/\/giveaway\/(.+?)\//)[1];
				}
				if (data.wl_ga) {
					await this.wbc_checkGiveaway(data, obj, username);
					doStop = true;
					break;
				}
			}
			if (doStop) {
				break;
			}
			if ((data.g_wl_gas && Object.keys(data.g_wl_gas).length) || groupGiveaways.length) {
				if (groupGiveaways.length) {
					const result = await this.wbc_getGroupGiveaways(data, groupGiveaways, obj, username);
					if (result) {
						break;
					}
				}
				const groups = JSON.parse(getValue('groups', '[]'));
				let found = false;
				for (const code in data.g_wl_gas) {
					if (data.g_wl_gas.hasOwnProperty(code)) {
						found = false;
						const groupCodes = data.g_wl_gas[code];
						const n = groupCodes.length;
						for (let i = 0; i < n && !found; i++) {
							found = groups.filter((item) => item.code === groupCodes[i] && item.member)[0];
						}
						if (!found) {
							data.g_wl_ga = code;
							break;
						}
					}
				}
				if (!found) {
					data.result = 'whitelisted';
					break;
				}
			}
			nextPage += 1;
			pagination = context.getElementsByClassName('pagination__navigation')[0];
			obj.autoSkip = Settings.get('wbc_skipUsers') && nextPage > Settings.get('wbc_pages');
		} while (
			!obj.Canceled &&
			!obj.manualSkip &&
			!obj.autoSkip &&
			(obj.Timestamp >= data.timestamp || obj.Timestamp === 0) &&
			pagination &&
			!pagination.lastElementChild.classList.contains('is-selected')
		);

		if (isStopped || (!data.ga && !data.wl_ga && !data.g_wl_ga)) {
			data.lastCheck = Date.now();
			data.result = isStopped ? 'nonexistent' : 'unknown';
			data.timestamp = obj.Timestamp;
		}
	}

	async wbc_getGroupGiveaways(data, groupGiveaways, obj, username) {
		const n = groupGiveaways.length;
		for (let i = 0; i < n; i++) {
			const groupGiveaway = groupGiveaways[i];
			obj.progressBar.setMessage(`Retrieving ${username}'s group giveaways (${i + 1} of ${n})...`);
			if (data.groupGiveaways && data.groupGiveaways[groupGiveaway]) {
				continue;
			}
			const result = await this.wbc_getGroups(data, groupGiveaway, obj);
			if (result) {
				return result;
			}
			if (obj.Canceled) {
				break;
			}
		}
		return false;
	}

	async wbc_getGroups(data, groupGiveaway, obj) {
		let nextPage = 1;
		let url = `/giveaway/${groupGiveaway}/_/groups/search?page=`;
		do {
			const response = await request({
				method: 'GET',
				queue: true,
				url: `${url}${nextPage}`,
			});
			const context = DOM.parse(response.responseText);
			const groups = context.getElementsByClassName('table__column__heading');
			const n = groups.length;
			if (n < 1) {
				data.result = 'none';
				return true;
			}
			if (!data.g_wl_gas) {
				data.g_wl_gas = {};
			}
			if (!data.g_wl_gas[groupGiveaway]) {
				data.g_wl_gas[groupGiveaway] = [];
			}
			for (let i = 0; i < n; i++) {
				const group = groups[i].getAttribute('href').match(/\/group\/(.+?)\//)[1];
				if (data.g_wl_gas[groupGiveaway].indexOf(group) < 0) {
					data.g_wl_gas[groupGiveaway].push(group);
				}
			}
			const pagination = context.getElementsByClassName('pagination__navigation')[0];
			if (pagination && !pagination.lastElementChild.classList.contains('is-selected')) {
				url = `${response.finalUrl}/search?page=`;
			} else {
				return false;
			}
		} while (!obj.Canceled);
		return false;
	}

	async wbc_getUsers(WBC, NextPage, CurrentPage, URL, Callback, Context) {
		let Matches, I, N, Match, Username, Pagination;
		if (WBC.Canceled) return;
		if (Context) {
			if (!WBC.lastPage) {
				WBC.lastPage = Shared.esgst.modules.generalLastPageLink.lpl_getLastPage(Context, true);
				WBC.lastPage = WBC.lastPage === 999999999 ? '' : ` of ${WBC.lastPage}`;
			}
			WBC.progressBar.setMessage(`Retrieving users (page ${NextPage}${WBC.lastPage})...`);
			Matches = Context.querySelectorAll(`a[href*="/user/"]`);
			for (I = 0, N = Matches.length; I < N; ++I) {
				Match = Matches[I].getAttribute('href').match(/\/user\/(.+)/);
				if (Match) {
					Username = Match[1];
					if (
						WBC.Users.indexOf(Username) < 0 &&
						Username !== WBC.Username &&
						Username === Matches[I].textContent &&
						!Matches[I].closest('.markdown')
					) {
						WBC.Users.push(Username);
					}
				}
			}
			Pagination = Context.getElementsByClassName('pagination__navigation')[0];
			if (Pagination && !Pagination.lastElementChild.classList.contains('is-selected')) {
				window.setTimeout(() => this.wbc_getUsers(WBC, NextPage, CurrentPage, URL, Callback), 0);
			} else {
				Callback();
			}
		} else if (!WBC.Canceled) {
			NextPage += 1;
			if (!Settings.get('wbc_checkPages') || NextPage <= Settings.get('wbc_maxPage')) {
				if (CurrentPage !== NextPage) {
					window.setTimeout(
						async () =>
							this.wbc_getUsers(
								WBC,
								NextPage,
								CurrentPage,
								URL,
								Callback,
								DOM.parse(
									(
										await request({
											method: 'GET',
											queue: true,
											url: URL + NextPage,
										})
									).responseText
								)
							),
						0
					);
				} else {
					window.setTimeout(
						() =>
							this.wbc_getUsers(
								WBC,
								NextPage,
								CurrentPage,
								URL,
								Callback,
								Shared.esgst.pageOuterWrap
							),
						0
					);
				}
			} else {
				Callback();
			}
		}
	}
}

const usersWhitelistBlacklistChecker = new UsersWhitelistBlacklistChecker();

export { usersWhitelistBlacklistChecker };
