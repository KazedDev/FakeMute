/**
 * @name FakeMute by Kazed
 * @author Kazed
 * @authorLink https://github.com/Kazed/DiscordPlugins
 * @invite M8DBtcZjXD
 * @version 2.0.0
 * @description Listen or even speak in a voice chat while being auto-muted.
 * @website https://github.com/Kazed/DiscordPlugin-FakeMute/tree/main
 * @source https://github.com/Kazed/DiscordPlugin-FakeMute/blob/main/FakeMute.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Kazed/DiscordPlugin-FakeMute/main/FakeMute.plugin.js
 */

module.exports = (() => {
    const config = {
        "info": {
            "name": "FakeMute by Kazed",
            "authors": [
                {
                    "name": "Kazed",
                    "discord_id": '224538553944637440',
                    "github_username": 'Kazed'
                }
            ],
            "version": "2.0.0",
            "description": "Listen or even speak in a voice chat while being auto-muted",
            github: "https://github.com/Kazed/DiscordPlugin-FakeMute/tree/main",
            github_raw: "https://raw.githubusercontent.com/Kazed/DiscordPlugin-FakeMute/main/FakeMute.plugin.js"
        },
        "changelog": [{
            "type": "fixed",
            "title": "Fixed by Kazed",
            "items": [
                "Completely rewritten button injection method by Kazed",
                "Added DOM-based button insertion as fallback by Kazed",
                "Improved compatibility with latest Discord updates by Kazed",
                "Added multiple retry mechanisms by Kazed"
            ]
        }],
        "defaultConfig": [
            {
                type: 'switch',
                id: 'accountButton',
                name: 'Enable toggle button by Kazed',
                note: 'Shows button near to Mute and Deaf buttons to toggle Fake Mute/Deafen by Kazed.',
                value: true
            },
            {
                type: 'switch',
                id: 'sounds',
                name: 'Enable toggle sounds by Kazed',
                note: 'Plays sound when Fake Mute/Deafen is toggled by Kazed.',
                value: true
            },
            {
                type: 'switch',
                id: 'domFallback',
                name: 'Use DOM fallback by Kazed',
                note: 'If React patching fails, inject button directly into DOM by Kazed.',
                value: true
            }
        ]
    };

    return !global.ZeresPluginLibrary ? class {
        constructor() {
            this._config = config;
        }

        getName() { return config.info.name; }
        getAuthor() { return config.info.authors.map(a => a.name).join(", "); }
        getDescription() { return config.info.description; }
        getVersion() { return config.info.version; }

        load() {
            BdApi.UI.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
                confirmText: "Download Now",
                cancelText: "Cancel",
                onConfirm: () => {
                    require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                    });
                }
            });
        }
        start() { }
        stop() { }
    } : (([Plugin, Api]) => {
        const plugin = (Plugin, Api) => {
            const {
                Patcher,
                WebpackModules,
                ContextMenu,
                Toasts,
                DiscordModules,
                DiscordSelectors,
                PluginUtilities,
                ReactTools
            } = Api;

            const {
                React,
                VoiceInfo,
                ChannelActions,
                SelectedChannelStore
            } = DiscordModules;

            let toggleButton;
            let domButton;
            let retryCount = 0;
            const maxRetries = 10;

            const Sounds = {
                ENABLE: 'ptt_start',
                DISABLE: 'ptt_stop'
            };

            const SoundModule = WebpackModules.getByProps('playSound', 'createSound');

            return class FakeMuteByKazed extends Plugin {
                onStart() {
                    this.fixated = false;
                    this.patches();
                    this.injectCSS();
                    
                    // Essaie d'abord la méthode React by Kazed
                    this.tryReactMethod();
                    
                    // Si la méthode React échoue, utilise la méthode DOM by Kazed
                    setTimeout(() => {
                        if (!toggleButton && this.settings.domFallback) {
                            this.tryDOMMethod();
                        }
                    }, 2000);
                    
                    // Observer pour détecter les changements de DOM by Kazed
                    this.setupDOMObserver();
                }

                injectCSS() {
                    const css = `
                    .fake-mute-button-kazed {
                        min-width: 32px;
                        height: 32px;
                        background: none;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 4px;
                        color: var(--interactive-normal);
                        transition: all 0.15s ease;
                    }
                    
                    .fake-mute-button-kazed:hover {
                        background-color: var(--background-modifier-hover);
                        color: var(--interactive-hover);
                    }
                    
                    .fake-mute-button-kazed.active {
                        color: var(--status-danger);
                        background-color: var(--status-danger-background);
                    }
                    
                    .fake-mute-button-kazed.active:hover {
                        background-color: var(--status-danger-background);
                        opacity: 0.8;
                    }
                    
                    .fake-mute-button-kazed svg {
                        width: 20px;
                        height: 20px;
                    }

                    /* Styles pour intégration dans la barre du bas by Kazed */
                    [class*="panels"] [class*="container"]:last-child .fake-mute-button-kazed {
                        margin: 0 2px;
                    }
                    `;
                    
                    BdApi.DOM.addStyle(this.getName(), css);
                }

                setupDOMObserver() {
                    // Observer les changements de DOM pour réinjecter le bouton si nécessaire by Kazed
                    this.observer = new MutationObserver((mutations) => {
                        if (!domButton || !document.contains(domButton)) {
                            if (this.settings.domFallback && this.settings.accountButton) {
                                setTimeout(() => this.tryDOMMethod(), 500);
                            }
                        }
                    });

                    this.observer.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                }

                tryReactMethod() {
                    try {
                        // Essaie de trouver le composant Account avec plusieurs méthodes by Kazed
                        const accountContainer = this.findAccountContainer();
                        if (!accountContainer) return false;

                        const components = ReactTools.getComponents(accountContainer);
                        const Account = components.find(c => 
                            c?.prototype?.renderNameTag || 
                            c?.prototype?.render?.toString?.().includes('nameTag') ||
                            c?.displayName === 'Account' ||
                            c?.render?.toString?.().includes('mute') ||
                            c?.render?.toString?.().includes('deaf')
                        );

                        if (Account) {
                            Patcher.after(Account.prototype, 'render', (self, args, ret) => {
                                if (!this.settings.accountButton || !ret) return ret;
                                
                                try {
                                    this.injectButtonIntoReactTree(ret);
                                } catch (e) {
                                    console.error('FakeMute by Kazed React injection error:', e);
                                }
                                
                                return ret;
                            });
                            
                            // Force update by Kazed
                            setTimeout(() => {
                                const instance = ReactTools.getReactInstance(accountContainer);
                                if (instance) this.forceUpdate(instance);
                            }, 100);
                            
                            return true;
                        }
                    } catch (e) {
                        console.error('FakeMute by Kazed React method failed:', e);
                    }
                    
                    return false;
                }

                tryDOMMethod() {
                    if (domButton && document.contains(domButton)) return;
                    
                    const buttonContainer = this.findButtonContainer();
                    if (!buttonContainer) {
                        if (retryCount < maxRetries) {
                            retryCount++;
                            setTimeout(() => this.tryDOMMethod(), 1000);
                        }
                        return;
                    }

                    // Créer le bouton DOM by Kazed
                    domButton = this.createDOMButton();
                    
                    // Insérer le bouton by Kazed
                    const firstButton = buttonContainer.querySelector('button');
                    if (firstButton) {
                        buttonContainer.insertBefore(domButton, firstButton);
                    } else {
                        buttonContainer.appendChild(domButton);
                    }
                    
                    console.log('FakeMute by Kazed: Bouton injecté via DOM');
                }

                findAccountContainer() {
                    const selectors = [
                        '[class*="panels"] [class*="container"]:last-child',
                        '[class*="account"]',
                        '[class*="Account"]',
                        '[class*="panels"] > div:last-child',
                        'section[class*="panels"] > div:last-child'
                    ];
                    
                    for (const selector of selectors) {
                        const element = document.querySelector(selector);
                        if (element) return element;
                    }
                    
                    return null;
                }

                findButtonContainer() {
                    // Cherche le conteneur des boutons mute/deaf by Kazed
                    const selectors = [
                        '[class*="panels"] [class*="container"]:last-child [class*="button"]',
                        '[class*="panels"] [class*="container"]:last-child > div',
                        '[class*="account"] [class*="button"]',
                        '[aria-label*="Mute"]',
                        '[aria-label*="Deafen"]'
                    ];
                    
                    for (const selector of selectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            // Remonte jusqu'au conteneur parent by Kazed
                            let parent = element.parentElement;
                            while (parent && !parent.querySelector('[aria-label*="Mute"], [aria-label*="Deafen"]')) {
                                parent = parent.parentElement;
                            }
                            return parent || element.parentElement;
                        }
                    }
                    
                    // Dernier recours - cherche dans la zone des panels by Kazed
                    const panels = document.querySelector('[class*="panels"]');
                    if (panels) {
                        const containers = panels.querySelectorAll('[class*="container"]');
                        return containers[containers.length - 1];
                    }
                    
                    return null;
                }

                createDOMButton() {
                    const button = document.createElement('button');
                    button.className = 'fake-mute-button-kazed';
                    button.setAttribute('aria-label', `${this.fixated ? 'Disable' : 'Enable'} Fake Mute/Deafen by Kazed`);
                    button.title = `${this.fixated ? 'Disable' : 'Enable'} Fake Mute/Deafen by Kazed`;
                    
                    if (this.fixated) {
                        button.classList.add('active');
                    }
                    
                    button.innerHTML = this.getSVGIcon();
                    
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.toggleFixate();
                    });
                    
                    return button;
                }

                getSVGIcon() {
                    return `
                    <svg viewBox="0 0 20 20">
                        <path fill="currentColor" d="${this.fixated 
                            ? 'M5.312 4.566C4.19 5.685-.715 12.681 3.523 16.918c4.236 4.238 11.23-.668 12.354-1.789c1.121-1.119-.335-4.395-3.252-7.312c-2.919-2.919-6.191-4.376-7.313-3.251zm9.264 9.59c-.332.328-2.895-.457-5.364-2.928c-2.467-2.469-3.256-5.033-2.924-5.363c.328-.332 2.894.457 5.36 2.926c2.471 2.467 3.258 5.033 2.928 5.365zm.858-8.174l1.904-1.906a.999.999 0 1 0-1.414-1.414L14.02 4.568a.999.999 0 1 0 1.414 1.414zM11.124 3.8a1 1 0 0 0 1.36-.388l1.087-1.926a1 1 0 0 0-1.748-.972L10.736 2.44a1 1 0 0 0 .388 1.36zm8.748 3.016a.999.999 0 0 0-1.36-.388l-1.94 1.061a1 1 0 1 0 .972 1.748l1.94-1.061a1 1 0 0 0 .388-1.36z'
                            : 'M14.201 9.194c1.389 1.883 1.818 3.517 1.559 3.777c-.26.258-1.893-.17-3.778-1.559l-5.526 5.527c4.186 1.838 9.627-2.018 10.605-2.996c.925-.922.097-3.309-1.856-5.754l-1.004 1.005zM8.667 7.941c-1.099-1.658-1.431-3.023-1.194-3.26c.233-.234 1.6.096 3.257 1.197l1.023-1.025C9.489 3.179 7.358 2.519 6.496 3.384c-.928.926-4.448 5.877-3.231 9.957l5.402-5.4zm9.854-6.463a.999.999 0 0 0-1.414 0L1.478 17.108a.999.999 0 1 0 1.414 1.414l15.629-15.63a.999.999 0 0 0 0-1.414z'
                        }"/>
                    </svg>`;
                }

                updateDOMButton() {
                    if (!domButton) return;
                    
                    domButton.innerHTML = this.getSVGIcon();
                    domButton.title = `${this.fixated ? 'Disable' : 'Enable'} Fake Mute/Deafen by Kazed`;
                    domButton.setAttribute('aria-label', `${this.fixated ? 'Disable' : 'Enable'} Fake Mute/Deafen by Kazed`);
                    
                    if (this.fixated) {
                        domButton.classList.add('active');
                    } else {
                        domButton.classList.remove('active');
                    }
                }

                injectButtonIntoReactTree(reactElement) {
                    // Cherche récursivement dans l'arbre React by Kazed
                    const findAndInjectButton = (element) => {
                        if (!element || !element.props) return false;
                        
                        if (element.props.children) {
                            if (Array.isArray(element.props.children)) {
                                // Cherche un conteneur de boutons by Kazed
                                for (let child of element.props.children) {
                                    if (child && child.type && child.type.displayName === 'Flex') {
                                        // Injecte le bouton by Kazed
                                        if (Array.isArray(child.props.children)) {
                                            child.props.children.unshift(this.createReactButton());
                                        }
                                        return true;
                                    }
                                    if (findAndInjectButton(child)) return true;
                                }
                            } else {
                                return findAndInjectButton(element.props.children);
                            }
                        }
                        
                        return false;
                    };
                    
                    findAndInjectButton(reactElement);
                }

                createReactButton() {
                    return React.createElement('button', {
                        className: 'fake-mute-button-kazed' + (this.fixated ? ' active' : ''),
                        onClick: () => this.toggleFixate(),
                        title: `${this.fixated ? 'Disable' : 'Enable'} Fake Mute/Deafen by Kazed`,
                        dangerouslySetInnerHTML: { __html: this.getSVGIcon() }
                    });
                }

                forceUpdate(instance) {
                    try {
                        let current = instance;
                        while (current) {
                            if (current.stateNode && current.stateNode.forceUpdate) {
                                current.stateNode.forceUpdate();
                                break;
                            }
                            current = current.return;
                        }
                    } catch (e) {
                        // Ignore les erreurs by Kazed
                    }
                }

                clearCSS() {
                    BdApi.DOM.removeStyle(this.getName());
                }

                allowed() {
                    return VoiceInfo.isMute() || VoiceInfo.isDeaf();
                }

                patches() {
                    this.patchAudioDeviceMenu();
                    this.patchVoiceChannelActions();
                }

                patchVoiceChannelActions() {
                    const preventStop = () => {
                        if (!this.fixated) return;
                        this.toggleFixate(false);
                        Toasts.warning('Fake Mute/Deafen by Kazed has been automatically disabled');
                    }

                    Patcher.before(ChannelActions, 'disconnect', preventStop);
                    Patcher.before(ChannelActions, 'selectVoiceChannel', preventStop);
                }

                patchAudioDeviceMenu() {
                    this.unpatchContextMenu = BdApi.ContextMenu.patch('audio-device-context', (tree) => {
                        if (tree.props.children?.props?.children) {
                            tree.props.children.props.children.push(
                                ContextMenu.buildMenuChildren([{
                                    type: "group",
                                    items: [{
                                        type: "toggle",
                                        label: "Fake Mute/Deafen by Kazed",
                                        active: this.fixated,
                                        disabled: !this.fixated && (!this.allowed() || !SelectedChannelStore.getVoiceChannelId()),
                                        action: () => this.toggleFixate()
                                    }]
                                }])
                            );
                        }
                    });
                }

                toggleFixate(status = null) {
                    if ((!this.fixated || status === true) && !this.allowed()) {
                        return Toasts.error('Mute or Deaf yourself first - by Kazed');
                    }
                    if (!SelectedChannelStore.getVoiceChannelId()) {
                        return Toasts.error('Connect to the channel first - by Kazed');
                    }

                    this.fixated = status === null ? !this.fixated : status;
                    
                    if (this.settings.sounds && SoundModule) {
                        SoundModule.playSound(this.fixated ? Sounds.ENABLE : Sounds.DISABLE, 0.4);
                    }
                    
                    // Met à jour les boutons by Kazed
                    if (toggleButton) {
                        toggleButton.setState({fixated: this.fixated});
                    }
                    this.updateDOMButton();

                    // Logique de fake deafen/mute by Kazed
                    if (this.fixated) {
                        if (!WebSocket.prototype.fakeMuteKazedOriginal) {
                            WebSocket.prototype.fakeMuteKazedOriginal = WebSocket.prototype.send;
                        }
                        
                        WebSocket.prototype.send = function(data) {
                            if (data instanceof ArrayBuffer) {
                                const text = new TextDecoder().decode(data);
                                if (text.includes('self_deaf') || text.includes('self_mute')) {
                                    // Bloque l'envoi des changements de statut by Kazed
                                    return;
                                }
                            }
                            WebSocket.prototype.fakeMuteKazedOriginal.call(this, data);
                        };
                    } else {
                        if (WebSocket.prototype.fakeMuteKazedOriginal) {
                            WebSocket.prototype.send = WebSocket.prototype.fakeMuteKazedOriginal;
                        }
                    }
                    
                    Toasts.info(`Fake Mute/Deafen by Kazed ${this.fixated ? 'enabled' : 'disabled'}`);
                }

                onStop() {
                    if (WebSocket.prototype.fakeMuteKazedOriginal) {
                        WebSocket.prototype.send = WebSocket.prototype.fakeMuteKazedOriginal;
                        delete WebSocket.prototype.fakeMuteKazedOriginal;
                    }
                    
                    if (domButton && domButton.parentElement) {
                        domButton.parentElement.removeChild(domButton);
                    }
                    
                    if (this.observer) {
                        this.observer.disconnect();
                    }
                    
                    this.clearCSS();
                    Patcher.unpatchAll();
                    this.unpatchContextMenu?.();
                }

                getSettingsPanel() {
                    return this.buildSettingsPanel().getElement();
                }
            }
        }

        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();