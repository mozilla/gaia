'use strict';

/*
 * A helper module for the built-in keyboard app.
 */

var Marionette = require('marionette-client');

function Keyboard(client) {
  this.client = client.scope({ searchTimeout: 20000 });
  this.actions = new Marionette.Actions(client);
}
module.exports = Keyboard;

Keyboard.ORIGIN =  'app://keyboard.gaiamobile.org';
Keyboard.MANIFEST_URL =  'app://keyboard.gaiamobile.org/manifest.webapp';

// Selectors for the DOM in built-in keyboard app.
Keyboard.Selector = Object.freeze({
  currentPanel: '.keyboard-type-container[data-active]',
  imeSwitchingKey: '.keyboard-type-container[data-active] ' +
    '.keyboard-key[data-keycode="-3"]',
  returnKey: '.keyboard-type-container[data-active] ' +
    '.keyboard-key[data-l10n-id="returnKey2"]',
  dismissSuggestionsButton: '.keyboard-type-container[data-active] ' +
    '.dismiss-suggestions-button',
  shiftKey: '.keyboard-type-container[data-active] ' +
    'button.keyboard-key[data-l10n-id="upperCaseKey2"]',
  key: '.keyboard-type-container[data-active] ' +
    'button.keyboard-key[data-keycode="%s"], ' +
    '.keyboard-type-container[data-active] ' +
    'button.keyboard-key[data-keycode-upper="%s"]',
  upperCaseKey: '.keyboard-type-container[data-active] ' +
    'button.keyboard-key[data-keycode-upper="%s"]',
  pageSwitchingKey: '.keyboard-type-container[data-active] ' +
    'button.keyboard-key[data-target-page="%s"]'
});

Keyboard.prototype = {
  // getters for DOM elements in keyboard app
  get imeSwitchingKey() {
    return this.client.findElement(Keyboard.Selector.imeSwitchingKey);
  },
  get returnKey() {
    return this.client.findElement(Keyboard.Selector.returnKey);
  },
  get dismissSuggestionsButton() {
    return this.client.findElement(Keyboard.Selector.dismissSuggestionsButton);
  },

  get currentPanel() {
    return this.client.findElement(Keyboard.Selector.currentPanel);
  },

  get shiftKey() {
    return this.client.findElement(Keyboard.Selector.shiftKey);
  },

  getKey: function getKey(key) {
    var keySelector = Keyboard.Selector.key;

    if (key >= '0' && key <='9') {
      this.switchToPage(1);
    } else if (key >= 'A' && key <= 'Z') {
      this.switchToPage(0);
      this.switchCase(true);
      keySelector = Keyboard.Selector.upperCaseKey;
    } else if ((key >= 'a' && key <= 'z') ||
               key == ' ') {
      this.switchToPage(0);
      this.switchCase(false);
    } else if (key === ' ' || key === '\u0008' || key === '\u000d') {
      // No need to switch -- should be on every page and every case.
    } else {
      var index = this.getSymbolPageIndex(key);
      this.switchToPage(index);
    }

    return this.client.findElement(
      keySelector.replace(/%s/g, key.charCodeAt(0)));
  },

  getPageSwitchingKey: function(index) {
    var selector = Keyboard.Selector.pageSwitchingKey.replace(/%s/g, index);
    return this.client.findElement(selector);
  },

  getSymbolPageIndex: function(key) {
    //First, try page 1
    this.switchToPage(1);
    var keySelector = Keyboard.Selector.key.replace(/%s/g, key.charCodeAt(0));

    if (this.isElementPresent(keySelector)) {
      return 1;
    }

    return 2;
  },

  switchCase: function switchCase(upperCase) {
    if (this.isUpperCase() === upperCase) {
      return;
    }

    var shiftKey = this.shiftKey;

    shiftKey.tap();
    this.client.waitFor(function() {
      var expected = upperCase ? 'true' : 'false';
      return (shiftKey.getAttribute('aria-pressed') === expected);
    });
  },

  switchToPage: function(index) {
    var pageIndex = this.getCurrentPageIndex();
    if (pageIndex === index) {
      return;
    }

    var pageSwitchingKey = this.getPageSwitchingKey(index);
    pageSwitchingKey.tap();
  },

  getCurrentPageIndex: function() {
    return this.client.executeScript(
      'return window.wrappedJSObject.app.layoutManager.currentPageIndex;');
  },

  isUpperCase: function () {
    return this.client.executeScript(
        'return ' +
        'window.wrappedJSObject.app.upperCaseStateManager.isUpperCase;');
  },

  isElementPresent: function(selector) {
    // XXX: Hack to use faster polling
    var pollClient = this.client.scope({ searchTimeout: 50 });

    try {
      pollClient.findElement(selector);
    } catch (e) {
      return false;
    }

    return true;
  },

  type: function(string) {
    string.split('').forEach(function(char) {
      var middleChar = this.getLongPressCharMiddleChar(char);
      var keyElement;
      if (!middleChar) {
        // Does not need long press
        keyElement = this.getKey(char);
        keyElement.tap();
      } else {
        // This is the key to long press.
        keyElement = this.getKey(middleChar);
        var chain = this.actions.press(keyElement).wait(1).perform();

        var longPressKeyElement = this.client.findElement(
          Keyboard.Selector.key.replace(/%s/g, char.charCodeAt(0)));
        chain.move(longPressKeyElement).release().perform();
      }
    }, this);
  },

  LONGPRESS_CHARS: Object.freeze({
    '0': 'º',
    '?': '¿',
    '$': '€£¥',
    '!': '¡',
    'a': 'áàâäåãāæ',
    'c': 'çćč',
    'e': 'éèêëēę€ɛ',
    'i': 'įīîìíï',
    'l': '£ł',
    'n': 'ńñ',
    'o': 'ɵøœōôòóö',
    's': 'ßśš$',
    'u': 'ūûùúü',
    'y': '¥ÿ',
    'z': 'žźż',
    'A': 'ÁÀÂÄÅÃĀÆ',
    'C': 'ÇĆČ',
    'E': 'ÉÈÊËĒĘ€Ɛ',
    'I': 'ĮĪÎÌÍÏ',
    'L': '£Ł',
    'N': 'ŃÑ',
    'O': 'ƟØŒŌÔÒÓÖ',
    'S': 'ŚŠŞ',
    'U': 'ŪÛÙÚÜ',
    'Y': '¥Ÿ',
    'Z': 'ŽŹŻ'
  }),

  getLongPressCharMiddleChar: function(char) {
    var chars = this.LONGPRESS_CHARS;

    for (var middleChar in chars) {
      if (chars[middleChar].indexOf(char) !== -1) {
        return middleChar;
      }
    }

    return undefined;
  }
};
