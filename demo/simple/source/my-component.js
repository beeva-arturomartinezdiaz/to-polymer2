'use strict';
Polymer({
  is: 'my-component',
  properties: {
    /**
     * Some property description
     */
    aProperty: {
      type: Object,
      value: function() {
        return {};
      }
    },
    /**
     * Other property description
     */
    otherProperty: {
      type: Number,
      value: 0
    }
  },
  listeners: {
    'click': '_handleClick',
    'other-event': '_handleClick'
  },
  /**
   * method description
   * @param event
   * @private
   */
  _handleClick: function(event) {
    //handles click event
    this.fire('some-event', foo);
  }
});