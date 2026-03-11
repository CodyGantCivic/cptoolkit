/**
 * Copied Skins Helper - Runs in MAIN world to access DesignCenter API
 *
 * This script is injected via <script> tag from the css-snippets content script.
 * It bridges the isolated content script world with the page's DesignCenter object.
 *
 * Communication is via CustomEvents on document:
 *   Content script -> Helper: 'cp-toolkit-copied-skins-request'
 *   Helper -> Content script: 'cp-toolkit-copied-skins-response'
 */
(function() {
    'use strict';

    var TOOLKIT_NAME = '[CP Copied Skins Helper]';

    // Listen for requests from the content script
    document.addEventListener('cp-toolkit-copied-skins-request', function(e) {
        var request = e.detail;
        if (!request || !request.action) return;

        var response = { action: request.action, requestId: request.requestId };

        try {
            switch (request.action) {
                case 'check':
                    // Check if DesignCenter is available
                    response.available = !!(window.DesignCenter &&
                        DesignCenter.themeJSON &&
                        DesignCenter.themeJSON.WidgetSkins);
                    break;

                case 'getSkins':
                    // Get list of valid skins (lightweight - just name and ID)
                    response.skins = [];
                    if (window.DesignCenter && DesignCenter.themeJSON && DesignCenter.themeJSON.WidgetSkins) {
                        DesignCenter.themeJSON.WidgetSkins.forEach(function(s) {
                            if (s.Name && s.WidgetSkinID && s.Components) {
                                response.skins.push({
                                    Name: s.Name,
                                    WidgetSkinID: s.WidgetSkinID,
                                    componentCount: s.Components.length
                                });
                            }
                        });
                    }
                    break;

                case 'readSkin':
                    // Read full skin component data for saving
                    var skinId = request.skinId;
                    response.skinData = null;

                    if (window.DesignCenter && DesignCenter.themeJSON && DesignCenter.themeJSON.WidgetSkins) {
                        var skin = null;
                        DesignCenter.themeJSON.WidgetSkins.forEach(function(s) {
                            if (s.WidgetSkinID == skinId && s.Components) {
                                skin = s;
                            }
                        });

                        if (skin) {
                            var components = [];
                            var COMPONENT_TYPES = [
                                { index: 0, name: 'Wrapper', view: 'items' },
                                { index: 1, name: 'Header', view: 'items' },
                                { index: 2, name: 'Item List', view: 'items' },
                                { index: 3, name: 'Item', view: 'items' },
                                { index: 4, name: 'Item Title', view: 'items' },
                                { index: 5, name: 'Item Secondary Text', view: 'items' },
                                { index: 6, name: 'Item Bullets', view: 'items' },
                                { index: 7, name: 'Item Link', view: 'items' },
                                { index: 8, name: 'Read On', view: 'items' },
                                { index: 9, name: 'View All', view: 'items' },
                                { index: 10, name: 'RSS', view: 'items' },
                                { index: 11, name: 'Footer', view: 'items' },
                                { index: 12, name: 'Tab List', view: 'tabbed' },
                                { index: 13, name: 'Tab', view: 'tabbed' },
                                { index: 14, name: 'Tab Panel', view: 'tabbed' },
                                { index: 15, name: 'Column Seperator', view: 'columns' },
                                { index: 16, name: 'Calendar Header', view: 'calendar' },
                                { index: 17, name: 'Cal Grid', view: 'calendar' },
                                { index: 18, name: 'Cal Day Headers', view: 'calendar' },
                                { index: 19, name: 'Cal Day', view: 'calendar' },
                                { index: 20, name: 'Cal Event Link', view: 'calendar' },
                                { index: 21, name: 'Cal Today', view: 'calendar' },
                                { index: 22, name: 'Cal Day Not In Month', view: 'calendar' },
                                { index: 23, name: 'Cal Wrapper', view: 'calendar' }
                            ];

                            for (var i = 0; i < 24; i++) {
                                if (skin.Components[i]) {
                                    var compInfo = COMPONENT_TYPES[i];
                                    components.push({
                                        idx: i,
                                        type: compInfo ? compInfo.name : 'Component ' + i,
                                        view: compInfo ? compInfo.view : 'items',
                                        data: JSON.parse(JSON.stringify(skin.Components[i]))
                                    });
                                }
                            }

                            response.skinData = {
                                sourceSkinName: skin.Name,
                                sourceSkinID: skin.WidgetSkinID,
                                componentIndexes: Array.from({length: 24}, function(_, i) { return i; }),
                                components: components
                            };
                        }
                    }
                    break;

                case 'applySkin':
                    // Apply saved skin data to a target skin
                    var targetSkinId = request.targetSkinId;
                    var savedComponents = request.components;
                    var sourceSkinId = request.sourceSkinId;
                    response.success = false;
                    response.copiedCount = 0;

                    if (!window.DesignCenter || !DesignCenter.themeJSON || !DesignCenter.themeJSON.WidgetSkins) {
                        response.error = 'DesignCenter not available';
                        break;
                    }

                    var targetSkin = null;
                    DesignCenter.themeJSON.WidgetSkins.forEach(function(s) {
                        if (s.WidgetSkinID == targetSkinId && s.Components) {
                            targetSkin = s;
                        }
                    });

                    if (!targetSkin) {
                        response.error = 'Target skin not found';
                        break;
                    }

                    var copiedIndexes = [];

                    savedComponents.forEach(function(componentData) {
                        var idx = componentData.idx;
                        if (typeof idx !== 'number' || idx < 0 || idx >= 24 || !componentData.data) {
                            return;
                        }

                        targetSkin.RecordStatus = DesignCenter.recordStatus.Modified;
                        targetSkin.Components[idx] = JSON.parse(JSON.stringify(componentData.data));
                        targetSkin.Components[idx].WidgetSkinID = parseInt(targetSkinId, 10);
                        targetSkin.Components[idx].RecordStatus = DesignCenter.recordStatus.Modified;

                        // Fix skin ID references in CSS fields
                        if (sourceSkinId) {
                            var fromId = String(sourceSkinId);
                            var toId = String(targetSkinId);
                            var pattern = 'skin' + fromId;

                            Object.keys(targetSkin.Components[idx]).forEach(function(field) {
                                var value = targetSkin.Components[idx][field];
                                if (value && typeof value === 'string' && value.indexOf(pattern) !== -1) {
                                    var updated = value.replace(
                                        new RegExp('\\.widget\\.skin' + fromId + '(?![0-9])', 'g'),
                                        '.widget.skin' + toId
                                    );
                                    updated = updated.replace(
                                        new RegExp('([^a-zA-Z])skin' + fromId + '(?![0-9])', 'g'),
                                        '$1skin' + toId
                                    );
                                    if (updated !== value) {
                                        targetSkin.Components[idx][field] = updated;
                                    }
                                }
                            });
                        }

                        copiedIndexes.push(idx);
                    });

                    // Touch API if available
                    if (typeof window.CPToolkitTouchSkinAdvancedFor === 'function') {
                        try {
                            window.CPToolkitTouchSkinAdvancedFor(targetSkinId, copiedIndexes);
                        } catch (err) {
                            console.warn(TOOLKIT_NAME + ' Touch API error:', err);
                        }
                    }

                    response.success = true;
                    response.copiedCount = copiedIndexes.length;
                    response.targetSkinName = targetSkin.Name;
                    break;

                case 'saveTheme':
                    if (typeof window.saveTheme === 'function') {
                        window.saveTheme();
                        response.success = true;
                    } else {
                        response.success = false;
                        response.error = 'saveTheme not available';
                    }
                    break;
            }
        } catch (err) {
            response.error = err.message || String(err);
            console.error(TOOLKIT_NAME + ' Error handling ' + request.action + ':', err);
        }

        document.dispatchEvent(new CustomEvent('cp-toolkit-copied-skins-response', {
            detail: response
        }));
    });

    // Signal that the helper is ready
    document.dispatchEvent(new CustomEvent('cp-toolkit-copied-skins-response', {
        detail: { action: 'ready' }
    }));
})();
