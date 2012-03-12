/*!
* jQuery UI Expandable v1.4
*
* Copyright 2012, Tony Kramer
* Dual licensed under the MIT or GPL Version 2 licenses.
* https://github.com/flamewave/jquery-ui-expandable/raw/master/GPL-LICENSE.txt
* https://github.com/flamewave/jquery-ui-expandable/raw/master/MIT-LICENSE.txt
*/

/*
* For documentation and for the latest version, see:
* https://github.com/flamewave/jquery-ui-expandable
*
* -------------
* Dependencies:
* -------------
* - jquery (1.4.2 and up)
* - jquery-ui (1.8.6 and up - core, widget)
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
        version: '1.4',
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
            showFx: {
                effect: 'slide',
                options: { direction: 'up' },
                duration: 'normal',
                callback: null
            },
            hideFx: {
                effect: 'slide',
                options: { direction: 'up' },
                duration: 'normal',
                callback: null
            },
            ajax: {
                enabled: false,
                attr: 'rel',
                cache: true,
                options: null
            },

            // Advanced options
            noWidgetClasses: false,
            contentElement: null, // jQueryObject function(jQueryObject head) : returns the element that contains the item's HTML content.
            contentContainer: null, // jQueryObject function(jQueryObject head) : returns the element that is the item's container element of the content and is the element that is hidden and shown.
            iconContainer: null, // jQueryObject function(jQueryObject head) : returns the element that is the item's container element of the arrow icon.
        },

        _isTable: false,
        _headers: null,

        /*** Creation/destruction ***/

        _create: function()
        {
            var options = this.options;
            if (this.element.attr('tagName').toLowerCase() === 'table')
            {
                this._isTable = true;

                // Set default title selector for tables if one hasn't been provided and the element is a table.
                if (!options.titleSelector || options.titleSelector.toLowerCase() === '> h3')
                    options.titleSelector = '> tbody > tr:even';

                // Set our element selectors that are used when the element is a table (if custom ones aren't provided.
                if (!options.contentElement)
                    options.contentElement = function(head) { return head.next().children('td,th').first(); };

                if (!options.iconContainer)
                    options.iconContainer = function(head) { return head.find('th,td').first(); };
            }
            else
            {
                // Make sure we have element selectors if custom ones were not provided.
                if (!options.contentElement)
                    options.contentElement = function(head) { return head.next(); };

                if (!options.iconContainer)
                    options.iconContainer = function(head) { return head; };
            }

            if (!options.contentContainer)
                options.contentContainer = function(head) { return head.next(); };

            this.element.addClass('ui-helper-reset ui-widget ui-expandable');
            this._headers = this.element.find(this.options.titleSelector);
            this._createExpandos();
        },

        destroy: function()
        {
            this.element.removeData('expandable.ajaxLoaded')
                .removeClass('ui-helper-reset ui-widget ui-expandable');

            var $this = this, v_use_icon = this._useIcons();
            this._headers.each(function(i)
            {
                var head = $(this), content = $this.options.contentContainer(head);

                head.removeClass('ui-widget-header ui-expandable-header ui-corner-top ui-corner-all ui-expandable-table-header')
                    .unbind('click.expandable');

                content.show().removeClass('ui-corner-bottom ui-widget-content ui-expandable-content ui-expandable-table-content');

                if (!$this._isTable)
                    content.next().remove(); // remove the spacer

                if (v_use_icon)
                    $this._removeIcon(head);
            });

            this._headers = null;
            $.Widget.prototype.destroy.call(this);
            return this;
        },

        refresh: function()
        {
            this._headers = this.element.find(this.options.titleSelector);
            this._createExpandos();
        },

        count: function()
        {
            return this._headers.length;
        },

        _createExpandos: function()
        {
            var $this = this, options = this.options, v_use_icon = this._useIcons();
            this._headers.each(function(i)
            {
                var head = $(this);
                if (head.data('expandable.created') === true)
                {
                    if (head.data('expandable.index') !== i)
                    {
                        // Item's index has changed, most likely due to the addition or removal of items.
                        head.data('expandable.index', i)
                            .unbind('click.expandable')
                            .bind('click.expandable', function() { $this.toggle(i); });
                    }
                    return;
                }

                var v_is_expanded = head.data('expanded') ? true : $this._getItemStateFromObj(i, head, options.defaultState, true),
                    content = options.contentContainer(head);

                head.data('expandable.created', true)
                    .data('expandable.index', i)
                    .bind('click.expandable', function() { $this.toggle(i); });
                content[v_is_expanded ? 'show' : 'hide']();

                // Make sure the item's content is loaded if the item's default state is expanded.
                if (v_is_expanded)
                    $this._loadContent(head);

                if ($this._isTable)
                {
                    head.addClass('ui-expandable-table-header');
                    content.addClass('ui-expandable-table-content');
                }
                else
                {
                    if (options.noWidgetClasses)
                    {
                        head.addClass('ui-expandable-header');
                        content.addClass('ui-expandable-content');
                    }
                    else
                    {
                        head.addClass('ui-helper-reset ui-widget-header ui-expandable-header')
                            .addClass(v_is_expanded ? 'ui-corner-top' : 'ui-corner-all');

                        content.addClass('ui-helper-reset ui-corner-bottom ui-widget-content ui-expandable-content');
                    }

                    content.after($('<div class="ui-expandable-spacer"></div>'));
                }

                if (v_use_icon)
                    $this._addIcon(head, v_is_expanded);
            });
        },

        _useIcons: function()
        {
            var icon = this.options.icon;
            return icon !== undefined
                && icon !== null
                && typeof icon.collapsed === 'string'
                && icon.collapsed.length > 0
                && typeof icon.expanded === 'string'
                && icon.expanded.length > 0;
        },

        _addIcon: function(head, isExpanded)
        {
            var options = this.options;
            options.iconContainer(head)
                .prepend(
                    $('<span class="ui-icon ui-expandable-icon"><\/span>')
                        .addClass(isExpanded ? options.icon.expanded : options.icon.collapsed)
                        .attr('title', isExpanded ? (options.icon.expandedTitle || $.ui.expandable.globalization.defaultIconExpandedTitle) : (options.icon.collapsedTitle || $.ui.expandable.globalization.defaultIconCollapsedTitle))
                );
        },

        _removeIcon: function(head)
        {
            this.options.iconContainer(head).children('.ui-expandable-icon').remove();
        },

        /*** Option setting ***/

        _setOption: function(key, value)
        {
            var $this = this;
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
                        $this._removeIcon(head);
                        $this._addIcon(head, $this._isExpanded(head));
                    });

                case 'defaultState':
                case 'titleSelector':
                case 'noWidgetClasses':
                case 'contentElement':
                case 'contentContainer':
                case 'iconContainer':
                    if (window.console)
                    {
                        var msg = 'Expandable: ' + key + ' option can only be set on creation.';
                        if (console.warn)
                            console.warn(msg);
                        else if (console.log)
                            console.log(msg);
                    }
                    break;

                default:
                    $.Widget.prototype._setOption.call(this, key, value);
                    break;
            }

            return this;
        },

        disable: function(items)
        {
            this.options.disabled = !items;
            this._parseItems(
                items,
                function(head)
                {
                    if (head && head.length)
                        head.add(this.options.contentContainer(head)).addClass('ui-expandable-disabled ui-state-disabled');
                },
                null
            );
            return this;
        },

        enable: function(items)
        {
            this.options.disabled = !!items;
            this._parseItems(
                items,
                function(head)
                {
                    if (head && head.length)
                        head.add(this.options.contentContainer(head)).removeClass('ui-expandable-disabled ui-state-disabled');
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

        setItemStates: function(state, noFx, reload)
        {
            if (this.options.disabled)
                return this;

            if (state === undefined || state === null)
                this.collapse(null, noFx);
            else
            {
                var self = this;
                this._headers.each(function(i)
                {
                    var head = $(this);
                    if (self._getItemStateFromObj(i, head, state, false))
                        self._expandItem(head, noFx, reload);
                    else
                        self._collapseItem(head, noFx);
                });
            }
            return this;
        },

        toggle: function(items, noFx, reload)
        {
            if (!this.options.disabled)
                this._parseItems(items, function(head) { this._toggleItem(head, noFx, reload); }, 'toggleAll');
            return this;
        },

        expand: function(items, noFx, reload)
        {
            if (!this.options.disabled)
                this._parseItems(items, function(head) { this._expandItem(head, noFx, reload); }, 'expandAll');
            return this;
        },

        collapse: function(items, noFx)
        {
            if (!this.options.disabled)
                this._parseItems(items, function(head) { this._collapseItem(head, noFx); }, 'collapseAll');
            return this;
        },

        _isExpanded: function(head)
        {
            return head && head.length && this.options.contentContainer(head).is(':visible');
        },

        _toggleItem: function(head, noFx, reload)
        {
            if (!head || !head.length || head.hasClass('ui-state-disabled'))
                return;

            if (this._isExpanded(head))
                this._collapseItem(head, noFx);
            else
                this._expandItem(head, noFx, reload);
        },

        _expandItem: function(head, noFx, reload)
        {
            if (!head || !head.length || head.hasClass('ui-state-disabled') || this._isExpanded(head))
                return;

            var options = this.options, showFx = options.showFx, content = options.contentContainer(head);
            if (this._trigger('beforeExpand', null, { head: head[0], content: content[0] }) === false)
                return;

            head.find('.ui-expandable-icon')
                .removeClass(options.icon.collapsed)
                .addClass(options.icon.expanded)
                .attr('title', options.icon.expandedTitle || $.ui.expandable.globalization.defaultIconExpandedTitle);

            if (!this._isTable && !options.noWidgetClasses)
                head.removeClass('ui-corner-all').addClass('ui-corner-top');

            if (showFx && noFx !== true)
            {
                var $this = this,
                    _duration = typeof showFx.duration === 'string' ? showFx.duration : showFx.duration || 400,
                    _complete = function()
                    {
                        if ($.isFunction(showFx.callback))
                            showFx.callback();

                        $this._trigger('expanded', null, { head: head[0], content: content[0] });
                        $this._loadContent(head, reload);
                    };

                if ($.effects && $.effects[showFx.effect])
                    content.show(showFx.effect, showFx.options, _duration, _complete);

                else if (showFx.effect && content[showFx.effect])
                    content[options.showFx.effect](_duration, _complete);

                else
                    content.show(_duration, _complete);
            }
            else
            {
                content.show();
                this._trigger('expanded', null, { head: head[0], content: content[0] });
                this._loadContent(head, reload);
            }
        },

        _collapseItem: function(head, noFx)
        {
            if (!head || !head.length || head.hasClass('ui-state-disabled') || !this._isExpanded(head))
                return;

            var options = this.options, hideFx = options.hideFx, content = options.contentContainer(head);
            if (this._trigger('beforeCollapse', null, { head: head[0], content: content[0] }) === false)
                return;

            head.find('.ui-expandable-icon')
                .removeClass(options.icon.expanded)
                .addClass(options.icon.collapsed)
                .attr('title', options.icon.collapsedTitle || $.ui.expandable.globalization.defaultIconCollapsedTitle);

            if (!this._isTable && !options.noWidgetClasses)
                head.removeClass('ui-corner-top').addClass('ui-corner-all');

            if (hideFx && noFx !== true)
            {
                var $this = this,
                    _duration = typeof hideFx.duration === 'string' ? hideFx.duration : hideFx.duration || 400,
                    _complete = function()
                    {
                        if ($.isFunction(hideFx.callback))
                            hideFx.callback();

                        $this._trigger('collapsed', null, { head: head[0], content: content[0] });
                    };

                if ($.effects && $.effects[hideFx.effect])
                    content.hide(hideFx.effect, hideFx.options, _duration, _complete);

                else if (content[hideFx.effect])
                    content[hideFx.effect](_duration, _complete);

                else
                    content.hide(_duration, _complete);
            }
            else
            {
                content.hide();
                this._trigger('collapsed', null, { head: head[0], content: content[0] });
            }
        },

        /*** Content Loading ***/

        loadContent: function(items, force)
        {
            if (this.options.ajax && this.options.ajax.enabled === true && this.options.ajax.attr)
                this._parseItems(items, function(head) { this._loadContent(head, force); }, null);

            return this;
        },

        // items parameter:
        // jQuery object: title HTML element of item to set content
        // "first" or "last": set content of the first or last item
        // number: set content by zero-based index
        // string: set content by HTML ID attribute value of title element
        // object: set content by object map (content parameter is ignored), must be in the following format: { itemTitleId: content, ... } or { itemIndex: content, ... } or a mix
        setContent: function(items, content)
        {
            if (items === undefined || items === null)
                throw 'No items specified.';

            if ($.isFunction(items))
            {
                items = items();
                if (items === undefined || items === null)
                    throw 'ExpandableException: Function given to items parameter can not return an undefined or null value.';
            }

            if (typeof items === 'string')
            {
                if (items === 'first' || items === 'last')
                    this._setItemContent(this._headers[items](), content, false, false);
                else
                    this._setItemContent(this._headers.filter('#' + items), content, false, false);
                return this;
            }

            if (typeof items === 'number' && items >= 0)
            {
                this._setItemContent(this._headers.eq(items), content, false, false);
                return this;
            }

            if (items instanceof jQuery)
            {
                if (items.length === 1)
                    this._setItemContent(items, content, false, false);

                else if (items.length > 1)
                {
                    var self = this;
                    items.each(function() { self._setItemContent($(this), content, false, false); });
                }
                return this;
            }

            for (var k in items)
            {
                var index = parseInt(k);
                if (!isNaN(index) && index >= 0)
                    this._setItemContent(this._headers.eq(index), items[k], false, false);
                else
                    this._setItemContent(this._headers.filter('#' + k), items[k], false, false);
            }

            return this;
        },

        _setItemContent: function(head, content, isAjaxLoad, isFailedLoad)
        {
            if (!head || !head.length)
                return;

            if ($.isFunction(content))
                content = content(head[0]);

            var item = this.options.contentElement(head).html(content);

            if (isAjaxLoad && this.options.ajax.cache === true)
                head.data('expandable.ajaxLoaded', !isFailedLoad);

            this._trigger(isAjaxLoad && isFailedLoad ? 'failedLoad' : 'contentSet', null, { head: head[0], content: item[0] });
        },

        _loadContent: function(head, force)
        {
            if (!head || !head.length)
                return;

            var options = this.options, ajax = options.ajax;
            if (ajax && ajax.enabled === true && ajax.attr && (force || ajax.cache !== true || head.data('expandable.ajaxLoaded') !== true))
            {
                var url = head.attr(ajax.attr);
                if (url && url.length)
                {
                    var success = ajax.options && $.isFunction(ajax.options.success) ? ajax.options.success : null;
                    var error = ajax.options && $.isFunction(ajax.options.error) ? ajax.options.error : null;
                    var opts = $.extend(true, { url: url, dataType: 'html' }, ajax.options);
                    var $this = this;

                    opts.success = function(data, textStatus, jqXHR)
                    {
                        if (success !== null)
                            data = success(data, textStatus, jqXHR, head[0]);

                        $this._setItemContent(head, data, true, false);
                    };

                    opts.error = function(jqXHR, textStatus, errorThrown)
                    {
                        if (error !== null)
                            textStatus = error(jqXHR, textStatus, errorThrown, head[0]);

                        $this._setItemContent(head, textStatus, true, true);
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
        // - function - a function that returns one of the other accepted parameter values (besided null or undefined) to represent the item(s)
        // - "first" or "last" - the first or last item
        // - string - item whose title HTML ID attribute value is the string value
        // - number - item at specified (zero based) index
        // - jQuery object - item with specified title element
        // - array - elements can be number or string
        //            - number: item at specified (zero based) index
        //            - string: item whose title HTML ID attribute value is the string value
        _parseItems: function(items, callback, allEvent)
        {
            var self = this;
            if (items === undefined || items === null)
            {
                this._headers.each(function() { return callback.call(self, $(this)); });

                if (typeof allEvent === 'string' && allEvent.length)
                    this._trigger(allEvent, null, null);

                return;
            }

            if ($.isFunction(items))
            {
                items = items();
                if (items === undefined || items === null)
                    throw 'ExpandableException: Function given to items parameter can not return an undefined or null value.';
            }

            if (typeof items === 'string')
            {
                if (!items.length)
                    throw 'items can not be an empty string.';

                else if (items === 'first' || items === 'last')
                    callback.call(this, this._headers[items]());

                else
                    callback.call(this, this._headers.filter('#' + items));
                return;
            }

            if (typeof items === 'number' && items >= 0)
            {
                callback.call(this, this._headers.eq(items));
                return;
            }

            if (items instanceof jQuery)
            {
                if (items.length === 1)
                    callback.call(this, items);

                else if (items.length > 1)
                    items.each(function() { return callback.call(self, $(this)); });

                return;
            }

            if ($.isArray(items) && items.length > 0)
            {
                for (var i = 0; i < items.length; i++)
                {
                    if (typeof items[i] === 'number' && items[i] >= 0)
                    {
                        if (callback.call(this, this._headers.eq(items[i])) === false)
                            break;
                    }
                    else if (typeof items[i] === 'string' && items[i].length)
                    {
                        if (callback.call(this, this._headers.filter('#' + items[i])) === false)
                            break;
                    }
                    else
                        throw 'ExpandableException: Array items must be either a non-negative number or a non-empty string.';
                }
                return;
            }

            throw 'ExpandableException: items parameter must be either a function, non-empty string, non-negative number, jQuery object instance, or an array of (non-negative) numbers and/or HTML ID attribute string values.';
        }
    });

    $.ui.expandable.globalization = {
        defaultIconCollapsedTitle: 'Click to expand',
        defaultIconExpandedTitle: 'Click to collapse'
    };

})(jQuery);