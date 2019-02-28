import Module from '../../class/Module';

class GiveawaysGiveawayLevelHighlighter extends Module {
  constructor() {
    super();
    this.info = {
      description: [
        [`ul`, [
          [`li`, `Highlights the level of a giveaway (in any page) by coloring it with the specified colors.`]
        ]]
      ],
      featureMap: {
        giveaway: `highlight`
      },
      id: `glh`,
      name: `Giveaway Level Highlighter`,
      sg: true,
      type: `giveaways`
    };
  }

  highlight(giveaways) {
    for (const giveaway of giveaways) {
      if (!giveaway.levelColumn) {
        continue;
      }
      const { color, bgColor } = this.esgst.glh_colors.filter(colors => giveaway.level >= parseInt(colors.lower) && giveaway.level <= parseInt(colors.upper))[0] || {};
      if (!color || !bgColor) {
        continue;
      }
      giveaway.levelColumn.setAttribute(`style`, `${color ? `color: ${color} !important;` : ``}${bgColor ? `background-color: ${bgColor};` : ``}`);
      giveaway.levelColumn.classList.add(`esgst-glh-highlight`);
    }
  }
}

export default GiveawaysGiveawayLevelHighlighter