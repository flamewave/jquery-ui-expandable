/*!
* jQuery UI Expandable v1.1
*
* Copyright 2011, Tony Kramer
* Dual licensed under the MIT or GPL Version 2 licenses.
* https://github.com/flamewave/jquery-ui-expandable/raw/master/GPL-LICENSE.txt
* https://github.com/flamewave/jquery-ui-expandable/raw/master/MIT-LICENSE.txt
*
* https://github.com/flamewave/jquery-ui-expandable
*/

/*
* -------------
* Dependencies:
* -------------
* - jquery (1.4.2)
* - jquery-ui (1.8.6 - core, widget)
*/
(function($)
{
    // Default CSS
    // .ui-expandable {}
    // .ui-expandable-header { display: block; cursor: pointer; padding: 5px; }
    // .ui-expandable-icon { float: left; margin-right: 5px; }
    // .ui-expandable-content { display: block; padding: 5px; border-top: none; }
    // .ui-expandable-spacer { height: 5px; overflow: hidden; }
    // .ui-expandable-table-header {}
    // .ui-expandable-table-content {}
    // .ui-expandable-disabled {}

    $.widget('ui.expandable', {
        version: '1.1',
        options: {
            disabled: false,
            defaultState: null,
            titleSelector: '> h3',
            icon: {
                collapsed: 'ui-icon-triangle-1-e',
                collapsedTitle: null,
                expanded: 'ui-icon-triangle-1-s',
                expandedTitle: null
            },
            expanded: null,
            collapsed: null,
            contentSet: null,
            expandAll: null,
            collapseAll: null,
            toggleAll: null,
            showFx: {
                effect: 'show',
                options: {},
                duration: 'normal',
                callback: null
            },
            hideFx: {
                effect: 'hide',
                options: {},
                duration: 'normal',
                callback: null
            },
            ajax: {
                enabled: false,
                attr: 'rel',
                cache: true,
                options: null,
                failedLoad: null
            }
        },

        _isTable: false,
        _headers: null,
        _getContentElement: function(head) { return head.next(); }, // returns the element that contains the item's HTML content.
        _getContentContainer: function(head) { return head.next(); }, // returns the element that is the item's container element of the content and is the element that is hidden and shown.
        _getIconContainer: function(head) { return head; }, // returns the element that is the item's container element of the arrow icon.

        /*** Creation/destruction ***/

        _create: function()
        {
            this._isTable = this.widget().attr('tagName').toLowerCase() === 'table';

            // Set default title selector for tables if one hasn't been provided and the element is a table.
            if (this._isTable && (!this.options.titleSelector || !this.options.titleSelector.length || this.options.titleSelector.toLowerCase() === '> h3'))
                this.options.titleSelector = '> tbody > tr:even';

            // Set our element selectors that are used when the element is a table.
            if (this._isTable)
            {
                this._getContentElement = function(head) { return head.next().children('td,th').first(); };
                this._getIconContainer = function(head) { return head.find('th,td').first(); };
            }

            this.widget().addClass('ui-helper-reset ui-widget ui-expandable');
            this._headers = this.widget().find(this.options.titleSelector);

            var self = this, v_use_icon = this._useIcons();
            this._headers.each(function(i)
            {
                var head = $(this),
                    v_is_expanded = self._getItemStateFromObj(i, head, self.options.defaultState, true),
                    content = self._getContentContainer(head);

                head.bind('click', function() { self.toggle(i); });
                content[v_is_expanded ? 'show' : 'hide']();

                if (self._isTable)
                {
                    head.addClass('ui-expandable-table-header');
                    content.addClass('ui-expandable-table-content');
                }
                else
                {
                    head.addClass('ui-helper-reset ui-widget-header ui-expandable-header')
                        .addClass(v_is_expanded ? 'ui-corner-top' : 'ui-corner-all');
                    content.addClass('ui-helper-reset ui-corner-bottom ui-widget-content ui-expandable-content')
                        .after($('<div class="ui-expandable-spacer">&nbsp;</div>'));
                }

                if (v_use_icon)
                    self._addIcon(head, v_is_expanded);
            });
        },

        destroy: function()
        {
            this.widget()
                .removeData('expandable.ajaxLoaded')
                .removeClass('ui-helper-reset ui-widget ui-expandable');

            var self = this, v_use_icon = this._useIcons();
            this._headers.each(function(i)
            {
                var head = $(this), content = self._getContentContainer(head);

                head.removeClass('ui-widget-header ui-expandable-header ui-corner-top ui-corner-all ui-expandable-table-header')
                    .unbind('click', function() { self.toggle(i); });

                content.show().removeClass('ui-corner-bottom ui-widget-content ui-expandable-content ui-expandable-table-content');

                if (!self._isTable)
                    content.next().remove(); // remove the spacer

                if (v_use_icon)
                    self._removeIcon(head);
            });

            this._headers = null;
            $.Widget.prototype.destroy.call(this);
            return this;
        },

        _useIcons: function()
        {
            return this.options.icon !== undefined
                && this.options.icon !== null
                && typeof this.options.icon.collapsed === 'string'
                && this.options.icon.collapsed.length > 0
                && typeof this.options.icon.expanded === 'string'
                && this.options.icon.expanded.length > 0;
        },

        _addIcon: function(head, isExpanded)
        {
            this._getIconContainer(head)
                .prepend(
                    $('<span class="ui-icon ui-expandable-icon">&nbsp;<\/span>')
                        .addClass(isExpanded ? this.options.icon.expanded : this.options.icon.collapsed)
                        .attr('title', isExpanded ? (this.options.icon.expandedTitle || $.ui.expandable.globalization.defaultIconExpandedTitle) : (this.options.icon.collapsedTitle || $.ui.expandable.globalization.defaultIconCollapsedTitle))
                );
        },

        _removeIcon: function(head)
        {
            this._getIconContainer(head).children('.ui-expandable-icon').remove();
        },

        /*** Option setting ***/

        _setOption: function(key, value)
        {
            var self = this;
            switch (key)
            {
                case 'disabled':
                    if (value)
                        this.disable();
                    else
                        this.enable();
                    break;

                case 'icon':
                    this._headers.each(function()
                    {
                        var head = $(this);
                        self._removeIcon(head);
                        self._addIcon(head, self._isExpanded(head));
                    });

                case 'defaultState':
                case 'titleSelector':
                    throw key + ' option can only be set on creation.';

                default:
                    $.Widget.prototype._setOption.call(this, key, value);
                    break;
            }

            return this;
        },

        disable: function(items)
        {
            this.options.disabled = true;
            this._parseItems(
                items,
                function(head)
                {
                    head.add(this._getContentContainer(head)).addClass('ui-expandable-disabled ui-state-disabled');
                },
                null
            );
            return this;
        },

        enable: function(items)
        {
            this.options.disabled = false;
            this._parseItems(
                items,
                function(head)
                {
                    head.add(this._getContentContainer(head)).removeClass('ui-expandable-disabled ui-state-disabled');
                },
                null
            );
            return this;
        },

        /*** Item expand/collapse/toggle ***/

        isExpanded: function(items)
        {
            var v_is_expanded = true;
            this._parseItems(
                items,
                function(head)
                {
                    if (!head.length)
                        return;

                    if (!this._isExpanded(head))
                    {
                        v_is_expanded = false;
                        return false;
                    }
                },
                null
            );
            return v_is_expanded;
        },

        setItemStates: function(state)
        {
            if (this.options.disabled)
                return this;

            if (state === undefined || state === null)
                this.collapse();
            else
            {
                var self = this;
                this._headers.each(function(i)
                {
                    var head = $(this);
                    if (self._getItemStateFromObj(i, head, state, false))
                        self._expandItem(head);
                    else
                        self._collapseItem(head);
                });
            }
            return this;
        },

        toggle: function(items)
        {
            if (!this.options.disabled)
                this._parseItems(items, this._toggleItem, this.options.toggleAll);
            return this;
        },

        expand: function(items)
        {
            if (!this.options.disabled)
                this._parseItems(items, this._expandItem, this.options.expandAll);
            return this;
        },

        collapse: function(items)
        {
            if (!this.options.disabled)
                this._parseItems(items, this._collapseItem, this.options.collapseAll);
            return this;
        },

        _isExpanded: function(head)
        {
            return this._getContentContainer(head).is(':visible');
        },

        _toggleItem: function(head)
        {
            if (!head.length || this.options.disabled)
                return;

            if (this._isExpanded(head))
                this._collapseItem(head);
            else
                this._expandItem(head);
        },

        _expandItem: function(head)
        {
            if (!head.length || this.options.disabled)
                return;

            head.find('.ui-expandable-icon')
                .removeClass(this.options.icon.collapsed)
                .addClass(this.options.icon.expanded)
                .attr('title', this.options.icon.expandedTitle || $.ui.expandable.globalization.defaultIconExpandedTitle);

            if (!this._isTable)
                head.removeClass('ui-corner-all').addClass('ui-corner-top');

            var content = this._getContentContainer(head);
            if (this.options.showFx)
            {
                if ($.effects && $.effects[this.options.showFx.effect])
                    content.show(this.options.showFx.effect, this.options.showFx.options, this.options.showFx.duration, this.options.showFx.callback);
                else
                    content[this.options.showFx.effect || 'show']((this.options.showFx.effect ? this.options.showFx.duration : null), this.options.showFx.callback);
            }
            else
                content.show();

            if ($.isFunction(this.options.expanded))
                this.options.expanded(this, head[0], content[0]);

            this._loadContent(head);
        },

        _collapseItem: function(head)
        {
            if (!head.length || this.options.disabled)
                return;

            head.find('.ui-expandable-icon')
                .removeClass(this.options.icon.expanded)
                .addClass(this.options.icon.collapsed)
                .attr('title', this.options.icon.collapsedTitle || $.ui.expandable.globalization.defaultIconCollapsedTitle);

            if (!this._isTable)
                head.removeClass('ui-corner-top').addClass('ui-corner-all');

            var content = this._getContentContainer(head);
            if (this.options.hideFx)
            {
                if ($.effects && $.effects[this.options.hideFx.effect])
                    content.hide(this.options.hideFx.effect, this.options.hideFx.options, this.options.hideFx.duration, this.options.hideFx.callback);
                else
                    content[(this.options.hideFx.effect == 'slideDown' ? 'slideUp' : (this.options.hideFx.effect == 'fadeIn' ? 'fadeOut' : 'hide'))]((this.options.hideFx.effect ? this.options.hideFx.duration : null), this.options.hideFx.callback);
            }
            else
                content.hide();

            if ($.isFunction(this.options.collapsed))
                this.options.collapsed(this, head[0], content[0]);
        },

        /*** Content Loading ***/

        loadContent: function(items)
        {
            if (this.options.ajax && this.options.ajax.enabled === true && this.options.ajax.attr && this.options.ajax.attr.length)
                this._parseItems(items, this._loadContent, null);

            return this;
        },

        // items parameter:
        // jQuery object: title HTML element of item to set content
        // number: set content by zero-based index
        // string: set content by HTML ID attribute value of title element
        // object: set content by object map (content parameter is ignored), must be in the following format: { itemTitleId: content, ... } or { itemIndex: content, ... } or a mix
        setContent: function(items, content)
        {
            if (items === undefined || items === null)
                throw 'No items specified.';

            if (items instanceof jQuery)
            {
                this._setItemContent(items, content, false, false);
                return this;
            }

            if (typeof items === 'number' && items >= 0)
            {
                this._setItemContent(this._headers.eq(items), content, false, false);
                return this;
            }

            if (typeof items === 'string')
            {
                this._setItemContent(this._headers.filter('#' + items), content, false, false);
                return this;
            }

            for (var k in items)
            {
                if (typeof items[k] === 'string')
                {
                    var index = parseInt(k);
                    if (!isNaN(index) && index >= 0)
                        this._setItemContent(this._headers.eq(index), items[k], false, false);
                    else
                        this._setItemContent(this._headers.filter('#' + k), items[k], false, false);
                }
            }

            return this;
        },

        _setItemContent: function(head, content, isAjaxLoad, isFailedLoad)
        {
            if (!head.length)
                return;

            var item = this._getContentElement(head).html(content);

            if (isAjaxLoad && this.options.ajax.cache === true)
                head.data('expandable.ajaxLoaded', !isFailedLoad);

            var fn = isAjaxLoad && isFailedLoad ? this.options.ajax.failedLoad : this.options.contentSet;
            if ($.isFunction(fn))
                fn(this, head[0], item[0]);
        },

        _loadContent: function(head)
        {
            if (!head.length)
                return;

            if (this.options.ajax && this.options.ajax.enabled === true && this.options.ajax.attr && this.options.ajax.attr.length && (this.options.ajax.cache !== true || head.data('expandable.ajaxLoaded') !== true))
            {
                var url = head.attr(this.options.ajax.attr);
                if (url.length)
                {
                    var success = this.options.ajax.options && $.isFunction(this.options.ajax.options.success) ? this.options.ajax.options.success : null;
                    var error = this.options.ajax.options && $.isFunction(this.options.ajax.options.error) ? this.options.ajax.options.error : null;
                    var opts = $.extend(true, { url: url, dataType: 'html' }, this.options.ajax.options);
                    var self = this;

                    opts.success = function(data, textStatus, jqXHR)
                    {
                        if (success !== null)
                            data = success(data, textStatus, jqXHR, head[0]);

                        self._setItemContent(head, data, true, false);
                    };

                    opts.error = function(jqXHR, textStatus, errorThrown)
                    {
                        if (error !== null)
                            textStatus = error(jqXHR, textStatus, errorThrown, head[0]);

                        self._setItemContent(head, textStatus, true, true);
                    }

                    $.ajax(opts);
                }
            }
        },

        /*** Utility ***/

        _getItemStateFromObj: function(index, head, obj, isInit)
        {
            if (obj === undefined || obj === null)
                return isInit;

            if (typeof obj === 'boolean')
                return obj;

            if ($.isFunction(obj))
                return obj(index, head[0]);

            if ($.isArray(obj))
                return obj.length >= index ? obj[index] === true : isInit;

            if (obj[index] !== undefined)
                return obj[index] === true;

            if (obj[index.toString()] !== undefined)
                return obj[index.toString()] === true;

            var v_id = head.attr('id');
            if (v_id.length && obj[v_id] !== undefined)
                return obj[v_id] === true;

            return isInit;
        },

        // items parameter:
        // - null or undefined (parameter is omitted) - all items
        // - jQuery object - item with specified title element
        // - number - item at specified (zero based) index
        // - array - elements can be number or string
        //            - number: item at specified (zero based) index
        //            - string: item whose title HTML ID attribute value is the string value
        _parseItems: function(items, callback, allEvent)
        {
            var self = this;
            if (items === undefined || items === null)
            {
                this._headers.each(function() { return callback.call(self, $(this)); });

                if ($.isFunction(allEvent))
                    allEvent(this);

                return;
            }

            if (items instanceof jQuery)
            {
                if (items.length === 1)
                    callback.call(self, items);

                else if (items.length > 1)
                    items.each(function() { return callback.call(self, $(this)); });

                return;
            }

            if (typeof items === 'number' && items >= 0)
            {
                callback.call(self, this._headers.eq(items));
                return;
            }

            if ($.isArray(items) && items.length > 0)
            {
                for (var i = 0; i < items.length; i++)
                {
                    if (typeof items[i] === 'number' && items[i] >= 0)
                    {
                        if (callback.call(self, this._headers.eq(items[i])) === false)
                            break;
                    }
                    else if (typeof items[i] === 'string')
                    {
                        if (callback.call(self, this._headers.filter('#' + items[i])) === false)
                            break;
                    }
                    else
                        throw 'Array items must be either a non-negative number or a string.';
                }
                return;
            }

            throw 'items parameter must be either a non-negative number or an array of (non-negative) numbers and/or HTML ID attribute string values.';
        }
    });

    $.ui.expandable.globalization = {
        defaultIconCollapsedTitle: 'Click to expand',
        defaultIconExpandedTitle: 'Click to collapse'
    };

})(jQuery);