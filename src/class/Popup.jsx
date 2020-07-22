import { ButtonSet } from './ButtonSet';
import { Shared } from './Shared';
import { Settings } from './Settings';
import { DOM } from './DOM';

class Popup {
	constructor(details) {
		this.custom = {};
		this.results = undefined;
		this.Options = undefined;
		this.Results = undefined;
		this.textArea = undefined;
		this.temp = details.isTemp;
		DOM.insert(
			document.body,
			'beforeend',
			<div className="esgst-hidden esgst-popup-layer" ref={(ref) => (this.layer = ref)}>
				{details.popup || (
					<div className="esgst-popup">
						<div className="esgst-popup-heading">
							<i
								className={`fa ${details.icon} esgst-popup-icon${
									details.icon ? '' : ' esgst-hidden'
								}`}
							></i>
							<div className={`esgst-popup-title${details.title ? '' : ' esgst-hidden'}`}>
								{details.title}
							</div>
						</div>
						<div className="esgst-popup-description"></div>
						<div
							className={`esgst-popup-scrollable ${
								details.addScrollable === 'left' ? 'esgst-text-left' : ''
							}`}
						>
							{details.scrollableContent}
						</div>
						<div className="esgst-popup-actions">
							<a className="esgst-hidden" href={Shared.esgst.settingsUrl}>
								Settings
							</a>
							<a className="esgst-popup-close">Close</a>
						</div>
					</div>
				)}
				<div className="esgst-popup-modal" title="Click to close the modal"></div>
			</div>
		);
		this.onCloseByUser = details.onCloseByUser;
		this.onClose = details.onClose;
		this.popup = this.layer.firstElementChild;
		this.modal = this.layer.lastElementChild;
		if (details.popup) {
			this.popup.classList.add('esgst-popup');
			this.popup.style.display = 'block';
			this.popup.style.maxHeight = `calc(100% - 150px)`;
			this.popup.style.maxWidth = `calc(100% - 150px)`;
		} else {
			this.popup.style.maxHeight = `calc(100% - 50px)`;
			this.popup.style.maxWidth = `calc(100% - 50px)`;
			this.icon = this.popup.firstElementChild.firstElementChild;
			this.title = this.icon.nextElementSibling;
			this.description = this.popup.firstElementChild.nextElementSibling;
			this.scrollable = this.description.nextElementSibling;
			this.actions = this.scrollable.nextElementSibling;
			let settings = this.actions.firstElementChild;
			if (!details.settings) {
				settings.classList.remove('esgst-hidden');
				settings.addEventListener('click', (event) => {
					if (!Settings.get('openSettingsInTab')) {
						event.preventDefault();
						Shared.esgst.modules.settingsModule.loadMenu(true);
					}
				});
			}
		}
		let closeButton = this.popup.querySelector(`.esgst-popup-close, .b-close`);
		if (closeButton) {
			closeButton.addEventListener('click', () => this.close(true));
		}
		this.modal.addEventListener('click', () => this.close(true));
		if (details.textInputs) {
			this.textInputs = [];
			details.textInputs.forEach((textInput) => {
				let input;
				DOM.insert(
					this.description,
					'beforeend',
					<fragment>
						{textInput.title || null}
						<input
							placeholder={textInput.placeholder || ''}
							ref={(ref) => (input = ref)}
							type="text"
						/>
					</fragment>
				);
				input.addEventListener('keydown', this.triggerButton.bind(this, 0));
				this.textInputs.push(input);
			});
		}
		if (details.options) {
			this.description.appendChild(Shared.common.createOptions(details.options));
			let inputs = this.description.lastElementChild.getElementsByTagName('input');
			for (let input of inputs) {
				switch (input.getAttribute('type')) {
					case 'number':
						Shared.common.observeNumChange(input, input.getAttribute('name'), true);
						break;
					case 'text':
						Shared.common.observeChange(input, input.getAttribute('name'), true);
						break;
					default:
						break;
				}
			}
		}
		if (details.buttons) {
			this.buttons = [];
			details.buttons.forEach((button) => {
				let set = new ButtonSet(button);
				this.buttons.push(set);
				this.description.appendChild(set.set);
			});
		}
		if (details.addProgress) {
			DOM.insert(this.description, 'beforeend', <div ref={(ref) => (this.progress = ref)}></div>);
			DOM.insert(
				this.description,
				'beforeend',
				<div ref={(ref) => (this.overallProgress = ref)}></div>
			);
		}
		this.id = Shared.common.addScope(details.name, this.popup);
	}

	open(callback) {
		Shared.common.setCurrentScope(this.id);
		this.isOpen = true;
		let n =
			9999 +
			document.querySelectorAll(
				`.esgst-popup-layer:not(.esgst-hidden), .esgst-popout:not(.esgst-hidden)`
			).length;
		if (Shared.esgst.openPopups > 0) {
			const highestN = parseInt(
				Shared.esgst.popups[Shared.esgst.openPopups - 1].popup.style.zIndex || 0
			);
			if (n <= highestN) {
				n = highestN + 1;
			}
		}
		Shared.esgst.openPopups += 1;
		Shared.esgst.popups.push(this);
		this.layer.classList.remove('esgst-hidden');
		this.layer.style.zIndex = n;
		if (this.textInputs) {
			this.textInputs[0].focus();
		}
		if (callback) {
			callback();
		}
	}

	close(byUser) {
		Shared.common.resetCurrentScope();
		if (this.temp) {
			Shared.common.removeScope(this.id);
			this.layer.remove();
		} else {
			this.layer.classList.add('esgst-hidden');
			if (Settings.get('minimizePanel')) {
				Shared.common.minimizePanel_addItem(this);
			}
		}
		if (byUser && this.onCloseByUser) {
			this.onCloseByUser();
		}
		if (this.onClose) {
			this.onClose();
		}
		Shared.esgst.openPopups -= 1;
		Shared.esgst.popups.pop();
		this.isOpen = false;
	}

	getTextInputValue(index) {
		return this.textInputs[index].value;
	}

	triggerButton(index, event) {
		if (event && (event.key !== 'Enter' || this.buttons[index].busy)) return;
		this.buttons[index].trigger();
	}

	isButtonBusy(index) {
		return !this.buttons[index] || this.buttons[index].busy;
	}

	removeButton(index) {
		let button = this.buttons.splice(index, 1)[0];
		button.set.remove();
	}

	setScrollable(jsx) {
		DOM.insert(this.scrollable, 'beforeend', <div>{jsx}</div>);
	}

	getScrollable(jsx) {
		let scrollableEl;
		DOM.insert(this.scrollable, 'beforend', <div ref={(ref) => (scrollableEl = ref)}>{jsx}</div>);
		return scrollableEl;
	}

	setError(message) {
		DOM.insert(
			this.progress,
			'atinner',
			<fragment>
				<i className="fa fa-times-circle"></i>
				<span>{message}</span>
			</fragment>
		);
	}

	setProgress(message) {
		if (this.progressMessage) {
			this.progressMessage.textContent = message;
		} else {
			DOM.insert(
				this.progress,
				'atinner',
				<fragment>
					<i className="fa fa-circle-o-notch fa-spin"></i>
					<span>{message}</span>
				</fragment>
			);
			this.progressMessage = this.progress.lastElementChild;
		}
	}

	clearProgress() {
		this.progress.innerHTML = '';
		this.progressMessage = null;
	}

	setOverallProgress(message) {
		this.overallProgress.textContent = message;
	}

	clear() {
		this.progress.innerHTML = '';
		this.progressMessage = null;
		this.overallProgress.textContent = '';
		this.scrollable.innerHTML = '';
	}

	setIcon(icon) {
		this.icon.className = `fa ${icon}`;
	}

	setTitle(title) {
		DOM.insert(this.title, 'atinner', title);
	}

	/**
	 *
	 * @param [temp]
	 */
	setDone(temp) {
		this.temp = temp;
		if (Settings.get('minimizePanel') && !this.isOpen) {
			Shared.common.minimizePanel_alert(this);
		}
	}

	reposition() {}
}

export { Popup };