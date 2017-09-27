'use strict';
Polymer({
    is: 'my-component',
    behaviors: [
        FakeBehavior,
        FakeSecondBehavior
    ],
    properties: {
        /**
         * Some property description
         * @type  {Object}
         */
        aProperty: {
            computed: '_someComputedMethod',
            type: Object,
            value: function () {
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
    observers: [
        '_aPropertyChanged(aProperty)',
        '_anotherPropertyChanged(aProperty, otherProperty)'
    ],
    listeners: {
        'click': '_handleClick',
        'other-event': '_handleClick',
        'source.event': '_handleClick'
    },
    ready: function () {
        //do something else
    },
    created: function() {
        //created scope
    },
    attached: function() {
        //attached scope
    },
    detached: function() {
        //detached scope
    },
    attributeChanged: function() {
        //attributeChanged scope
    },
    /**
     * Computed method for <em>a property</em>
     * @private
     */
    _someComputedMethod: function () {
        //do some computed calcs
    },
    /**
     * method description
     * @param newValue
     * @private
     */
    _aPropertyChanged: function (newValue) {
        //do something
        this.set('property', 'value');
        return this.get('property');
    },
    /**
     * method description
     * @param event
     * @private
     */
    _handleClick: function (event) {
        //handles click event
        this.fire('some-event', 'foo');
    }
});
