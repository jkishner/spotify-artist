const { Plugin, PluginSettingTab, Setting, Notice, Modal } = require("obsidian");

class SpotifyArtistLookupPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        
        this.addCommand({
            id: "search-spotify-artist",
            name: "Search Spotify Artist",
            callback: () => this.searchArtist(),
        });

        this.addSettingTab(new SpotifySettingsTab(this.app, this));
        console.log("Spotify Artist Lookup Plugin Loaded");
    }

    async searchArtist() {
        new TextInputModal(this.app, "Enter artist name:", async (artistName) => {
            if (!artistName) {
                new Notice("Artist search canceled.");
                return;
            }

            const accessToken = await this.getSpotifyAccessToken();
            if (!accessToken) return;

            const artistData = await this.fetchArtistData(artistName, accessToken);
            if (!artistData) {
                new Notice("Artist not found.");
                return;
            }

            await this.createArtistNote(artistData);
        }).open();
    }

    async getSpotifyAccessToken() {
        const clientId = this.settings.clientId;
        const clientSecret = this.settings.clientSecret;
        if (!clientId || !clientSecret) {
            new Notice("Please set your Spotify API credentials in settings.");
            return null;
        }
        
        const credentials = btoa(`${clientId}:${clientSecret}`);
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: "grant_type=client_credentials"
        });

        if (!response.ok) {
            new Notice("Error retrieving Spotify access token. Check your API credentials.");
            return null;
        }

        const data = await response.json();
        return data.access_token;
    }

    async fetchArtistData(artistName, accessToken) {
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=10`;
        const response = await fetch(searchUrl, {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });

        const data = await response.json();
        if (!data.artists.items.length) return null;

        // Sort artists by popularity (highest first)
        const sortedArtists = data.artists.items.sort((a, b) => b.popularity - a.popularity);

        return sortedArtists[0]; // Select the most popular artist
    }

    async createArtistNote(artist) {
        const noteTitle = artist.name;
        const genres = artist.genres.length ? `genres:\n${artist.genres.map(g => `  - ${g}`).join("\n")}` : "";
        const spotifyUrl = artist.external_urls.spotify;
        const everynoiseUrl = `https://everynoise.com/artistprofile.cgi?id=${artist.id}`;
        const chosicUrl = `https://www.chosic.com/artist/${encodeURIComponent(artist.name.toLowerCase())}/${artist.id}/`;
        const imageUrl = artist.images.length ? artist.images[0].url : "";
        const filePath = `${this.settings.savePath}/${noteTitle}.md`;
        
        const content = `---
${genres}
spotifyUrl: ${spotifyUrl}
everynoiseUrl: ${everynoiseUrl}
chosicUrl: ${chosicUrl}
---

![image](${imageUrl})`;
        
        const file = await this.app.vault.create(filePath, content);
        new Notice(`Created note: ${filePath}`);
    }

    async loadSettings() {
        this.settings = Object.assign({ savePath: "" }, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class TextInputModal extends Modal {
    constructor(app, title, callback) {
        super(app);
        this.title = title;
        this.callback = callback;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: this.title });

        const input = contentEl.createEl("input", { type: "text" });
        input.style.width = "100%";

        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                this.callback(input.value);
                this.close();
            }
        });

        const submitBtn = contentEl.createEl("button", { text: "Search" });
        submitBtn.style.marginTop = "10px";
        submitBtn.addEventListener("click", () => {
            this.callback(input.value);
            this.close();
        });

        input.focus();
    }

    onClose() {
        this.contentEl.empty();
    }
}

class SpotifySettingsTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    
    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Spotify Client ID")
            .setDesc("Enter your Spotify Developer Client ID")
            .addText(text => text.setValue(this.plugin.settings.clientId || "").onChange(async (value) => {
                this.plugin.settings.clientId = value;
                await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
            .setName("Spotify Client Secret")
            .setDesc("Enter your Spotify Developer Client Secret")
            .addText(text => text.setValue(this.plugin.settings.clientSecret || "").onChange(async (value) => {
                this.plugin.settings.clientSecret = value;
                await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
            .setName("Save Path")
            .setDesc("Enter the relative path where artist notes should be saved")
            .addText(text => text.setValue(this.plugin.settings.savePath || "").onChange(async (value) => {
                this.plugin.settings.savePath = value.trim();
                await this.plugin.saveSettings();
            }));
    }
}

module.exports = SpotifyArtistLookupPlugin;

