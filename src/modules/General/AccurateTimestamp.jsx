import { Module } from '../../class/Module';
import dateFns_format from 'date-fns/format';
import dateFns_differenceInHours from 'date-fns/differenceInHours';
import dateFns_isSameYear from 'date-fns/isSameYear';
import { Settings } from '../../class/Settings';
import { DOM } from '../../class/DOM';

class GeneralAccurateTimestamp extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Replaces a timestamp (in any page) with an accurate timestamp. For example, "2 hours
						ago" becomes "Jan 1, 2017, 0:00:00 - 2 hours ago".
					</li>
					<li>Here are some format examples:</li>
					<ul>
						<li>Jan 1, 2017 - MMM d, yyyy</li>
						<li>Jan 01, 2017 - MMM dd, yyyy</li>
						<li>01/01/2017 - dd/MM/yyyy</li>
						<li>2017/01/01 - yyyy/MM/dd</li>
						<li>6:00 - H:mm</li>
						<li>6:00 AM - h:mm a</li>
						<li>06:00 - HH:mm</li>
						<li>06:00:00 - HH:mm:ss</li>
					</ul>
					<li>{`If you don't want the day and month to be shown when the difference is less than 24 hours, delimit them with "DM{}" in the format. For example, let's suppose that it's currently January 1, 2017, 06:00:00, and that the format is "MMM d, HH:mm:ss". Let's use the timestamp "Jan 1, 12:00:00" as an example. That's a less than 24 hours difference, so if the format was changed to "DM{MMM d, }HH:mm:ss", the timestamp would be just "12:00:00".`}</li>
					<li>{`If you don't want the year to be shown when it's the current year, delimit it with "Y{}" in the format. For example, let's suppose that it's currently January 1, 2017, 06:00:00, and that the format is "MMM d, yyyy, HH:mm:ss". Let's use the timestamp "Jan 1, 2017, 12:00:00" as an example. That's the current year, so if the format was changed to "MMM d, Y{yyyy }HH:mm:ss", the timestamp would be just "Jan 1, 12:00:00".`}</li>
					<li>{`If you don't want the seconds to be shown when they are equal to 0, delimit them with "S{}" in the format. For example, let's suppose that it's currently January 1, 2017, 06:30:00, and that the format is "MMM d, yyyy, HH:mm:ss". The timestamp would be "Jan 1, 2017, 06:30:00". The seconds are equal to 0, so if the format was changed to "MMM d, yyyy HH:mmS{:ss}", the timestamp would be just "Jan 1, 2017, 06:30".`}</li>
					<li>{`And of course, you can combine the three, for example: DM{MMM d, }Y{yyyy }HH:mmS{:ss}`}</li>
				</ul>
			),
			features: {
				at_t: {
					name: "Apply format to SteamGifts' date tooltips.",
					sg: true,
				},
			},
			id: 'at',
			name: 'Accurate Timestamp',
			inputItems: [
				{
					id: 'at_format',
					prefix: `Timestamp format: `,
					tooltip: `For the date templates, ESGST uses date-fns v2.0.0-alpha.25, so check the accepted tokens here: https://date-fns.org/v2.0.0-alpha.25/docs/Getting-Started.`,
				},
			],
			sg: true,
			st: true,
			type: 'general',
		};
	}

	init() {
		if (Settings.get('at_t')) {
			const script = document.createElement('script');
			script.textContent = `
				if (document.readyState === "complete") {
					esgst_at_t();
				} else {
					$(window).on("load", function () {
						esgst_at_t();
					});
				}

				function esgst_at_t() {
					$(document).off("mouseenter", "[data-timestamp]");
					$(document).on("mouseenter", "[data-timestamp]", function() {
						var e = $(this).attr("title");
						if (void 0 === e || !1 === e) {
							$(this).attr("data-ui-tooltip", '{"rows":[{"icon" : [{"class" : "fa-clock-o", "color" : "#84cfda"}], "columns":[{"name" : "' + $(this).attr("data-esgst-timestamp") + '"}]}]}');
						}
					});
				}
			`;
			document.body.appendChild(script);
			script.remove();
		}

		this.esgst.endlessFeatures.push(this.at_getTimestamps.bind(this));
	}

	at_formatTimestamp(seconds) {
		return dateFns_format(
			seconds,
			(Settings.get('at_format') || `MMM dd, yyyy, HH:mm:ss`)
				.replace(
					/DM\{(.+?)}/,
					Math.abs(dateFns_differenceInHours(Date.now(), seconds)) < 24 ? '' : `$1`
				)
				.replace(/Y\{(.+?)}/, dateFns_isSameYear(Date.now(), seconds) ? '' : `$1`)
				.replace(/S\{(.+?)}/, new Date(seconds).getSeconds() === 0 ? '' : `$1`)
		);
	}

	/**
	 * @param context
	 * @param [main]
	 * @param [source]
	 * @param [endless]
	 */
	at_getTimestamps(context, main, source, endless) {
		let timestamps, i, n, timestamp, text, edited, seconds, accurateTimestamp;
		timestamps = context.querySelectorAll(
			`${
				endless
					? `.esgst-es-page-${endless} [data-timestamp], .esgst-es-page-${endless}[data-timestamp]`
					: `[data-timestamp]`
			}`
		);
		for (i = 0, n = timestamps.length; i < n; ++i) {
			timestamp = timestamps[i];
			if (
				((this.esgst.activeDiscussions &&
					((this.esgst.activeDiscussions.contains(timestamp) &&
						Settings.get('adots_index') === 0) ||
						!this.esgst.activeDiscussions.contains(timestamp))) ||
					!this.esgst.activeDiscussions) &&
				!timestamp.classList.contains('esgst-at')
			) {
				text = timestamp.textContent;
				edited = text.match(/\*/);
				seconds = parseInt(timestamp.getAttribute('data-timestamp')) * 1e3;
				accurateTimestamp = this.at_formatTimestamp(seconds);
				timestamp.setAttribute('data-esgst-timestamp', accurateTimestamp);
				if (edited) {
					text = ` (Edited ${accurateTimestamp})`;
				} else {
					text = `${accurateTimestamp} - ${text}`;
				}
				timestamp.classList.add('esgst-at');
				timestamp.textContent = text;
			}
		}
	}
}

const generalAccurateTimestamp = new GeneralAccurateTimestamp();

export { generalAccurateTimestamp };
