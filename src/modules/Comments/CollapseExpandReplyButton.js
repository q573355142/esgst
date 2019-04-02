import { Module } from '../../class/Module';
import { shared } from '../../class/Shared';

class CommentsCollapseExpandReplyButton extends Module {
  constructor() {
    super();
    this.info = {
      description: [
        [`ul`, [
          [`li`, [
            `Adds a button (`,
            [`i`, { class: `fa fa-plus-square` }],
            ` if all of the replies in the page are collapsed and `,
            [`i`, { class: `fa fa-minus-square` }],
            ` if they are expanded) above the comments (in any page) that allows you to collapse/expand all of the replies (comments nested 2 or more levels deep) in the page.`
          ]],
          [`li`, `Also adds the same button in front of each comment nested 1 level deep in the page, which allows you to collapse/expand the replies of the comment individually.`]
        ]]
      ],
      features: {
        cerb_a: {
          name: `Automatically collapse all replies when visiting a page.`,
          sg: true,
          st: true
        }
      },
      id: `cerb`,
      name: `Collapse/Expand Reply Button`,
      sg: true,
      sgPaths: /^(Giveaway\s-\sComments|Discussion|Ticket|Trade)$/,
      st: true,
      type: `comments`
    };
  }

  init() {
    if (!this.esgst.commentsPath) return;
    let button, collapse, comments, expand;
    comments = document.getElementsByClassName(`comments`)[0];
    if (comments && comments.children.length) {
      this.esgst.cerbButtons = [];
      button = shared.common.createElements(this.esgst.mainPageHeading, `afterEnd`, [{
        attributes: {
          class: `esgst-cerb-button esgst-clickable`
        },
        type: `div`,
        children: [{
          type: `span`,
          children: [{
            attributes: {
              class: `fa fa-minus-square`
            },
            type: `i`
          }, {
            text: ` Collapse all replies`,
            type: `node`
          }]
        }, {
          attributes: {
            class: `esgst-hidden`
          },
          type: `span`,
          children: [{
            attributes: {
              class: `fa fa-plus-square`
            },
            type: `i`
          }, {
            text: ` Expand all replies`,
            type: `node`
          }]
        }]
      }]);
      collapse = button.firstElementChild;
      expand = collapse.nextElementSibling;
      collapse.addEventListener(`click`, this.cerb_collapseAllReplies.bind(this, collapse, expand));
      expand.addEventListener(`click`, this.cerb_expandAllReplies.bind(this, collapse, expand));
      this.esgst.endlessFeatures.push(this.cerb_getReplies.bind(this, collapse, expand));
    }
  }

  cerb_getReplies(collapse, expand, context, main, source, endless) {
    let id = context === document && main ? window.location.hash.replace(/#/, ``) : null,
      permalink = id ? document.getElementById(id) : null,
      elements = context.querySelectorAll(`${endless ? `.esgst-es-page-${endless} :not(.esgst-popup) .comments > .comment, .esgst-es-page-${endless}:not(.esgst-popup) .comments > .comment` : `:not(.esgst-popup) .comments > .comment`}, ${endless ? `.esgst-es-page-${endless} :not(.esgst-popup) .comments > .comment_outer, .esgst-es-page-${endless}:not(.esgst-popup) .comments > .comment_outer` : `:not(.esgst-popup) .comments > .comment_outer`}`);
    if (!elements.length) return;
    for (let reply of elements) {
      let replies = reply.querySelector(`.comment__children, .comment_children`);
      if (replies && replies.children.length) {
        this.cerb_setButton(shared.common.createElements(reply.firstElementChild, `afterBegin`, [{
          attributes: {
            class: `esgst-cerb-reply-button esgst-clickable`
          },
          type: `div`,
          children: [{
            attributes: {
              title: shared.common.getFeatureTooltip(`cerb`, `Collapse all replies`)
            },
            type: `span`,
            children: [{
              attributes: {
                class: `fa fa-minus-square`
              },
            }]
          }, {
            attributes: {
              class: `esgst-hidden`,
              title: shared.common.getFeatureTooltip(`cerb`, `Expand all replies`)
            },
            type: `span`,
            children: [{
              attributes: {
                class: `fa fa-plus-square`
              },
            }]
          }]
        }]), permalink && reply.contains(permalink), reply, replies.children);
      }
    }
    if (this.esgst.cerb_a) {
      this.cerb_collapseAllReplies(collapse, expand);
    }
  }

  cerb_setButton(button, permalink, reply, replies) {
    let collapse, expand;
    collapse = button.firstElementChild;
    expand = collapse.nextElementSibling;
    this.esgst.cerbButtons.push({
      collapse: this.cerb_collapseReplies.bind(this, collapse, expand, replies),
      expand: this.cerb_expandReplies.bind(this, collapse, expand, replies),
      permalink: permalink
    });
    collapse.addEventListener(`click`, this.cerb_collapseReplies.bind(this, collapse, expand, replies));
    expand.addEventListener(`click`, this.cerb_expandReplies.bind(this, collapse, expand, replies));
    if (this.esgst.cerb_a && !permalink) {
      collapse.classList.toggle(`esgst-hidden`);
      expand.classList.toggle(`esgst-hidden`);
    }
  }

  cerb_collapseReplies(collapse, expand, replies) {
    let i, n;
    for (i = 0, n = replies.length; i < n; ++i) {
      replies[i].classList.add(`esgst-hidden`);
    }
    collapse.classList.add(`esgst-hidden`);
    expand.classList.remove(`esgst-hidden`);
  }

  cerb_expandReplies(collapse, expand, replies) {
    let i, n;
    for (i = 0, n = replies.length; i < n; ++i) {
      replies[i].classList.remove(`esgst-hidden`);
    }
    collapse.classList.remove(`esgst-hidden`);
    expand.classList.add(`esgst-hidden`);
  }

  cerb_collapseAllReplies(collapse, expand) {
    let i, n;
    for (i = 0, n = this.esgst.cerbButtons.length; i < n; ++i) {
      if (!this.esgst.cerbButtons[i].permalink) {
        this.esgst.cerbButtons[i].collapse();
      }
    }
    collapse.classList.add(`esgst-hidden`);
    expand.classList.remove(`esgst-hidden`);
  }

  cerb_expandAllReplies(collapse, expand) {
    let i, n;
    for (i = 0, n = this.esgst.cerbButtons.length; i < n; ++i) {
      this.esgst.cerbButtons[i].expand();
    }
    collapse.classList.remove(`esgst-hidden`);
    expand.classList.add(`esgst-hidden`);
  }
}

const commentsCollapseExpandReplyButton = new CommentsCollapseExpandReplyButton();

export { commentsCollapseExpandReplyButton };