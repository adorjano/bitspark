// NostrCacheStore.js
import { writable } from 'svelte/store';

// Definiert die Struktur des Cache-Objekts
class NostrEventCache {
  constructor() {
    this.events = new Map();
    this.kindIndex = new Map();
    this.authorIndex = new Map();
  }

  // Hilfsmethode zur Verarbeitung von Profil-Events
  processProfileEvent(event) {
    // Frühzeitige Rückkehr, wenn es sich nicht um ein Profil-Event handelt
    if (event.kind !== 0) {
      return;
    }

    // Versuchen, den Inhalt des Events zu parsen
    try {
      event.profileData = JSON.parse(event.content);
    } catch (e) {
      console.error("Fehler beim Parsen des Profil-Contents", e);
      event.profileData = {};
    }

    event.profileData.pubkey = event.pubkey;
    
    // Extrahieren der GitHub-Informationen aus den Tags
    const githubTag = event.tags.find(tag => tag[0] === "i" && tag[1].startsWith("github:"));
    if (githubTag) {
      const githubParts = githubTag[1].split(":");
      event.profileData.githubUsername = githubParts[1];
      event.profileData.githubProof = githubTag[2];
    }

    // Weitere spezifische Verarbeitung kann hier hinzugefügt werden
  }

  // Fügt ein Event hinzu oder aktualisiert es
  addOrUpdateEvent(event) {
    // Prüfen, ob das Event bereits existiert
    const existingEvent = this.events.get(event.id);

    if (!existingEvent) {
      this.processProfileEvent(event);
      // Add new event if it does not exist
      this.events.set(event.id, event);
      console.log("Event Added:", event);

      // Aktualisieren der kindIndex Map
      if (!this.kindIndex.has(event.kind)) {
        this.kindIndex.set(event.kind, new Set());
      }
      this.kindIndex.get(event.kind).add(event);

      // Aktualisieren der authorIndex Map
      if (!this.authorIndex.has(event.pubkey)) {
        this.authorIndex.set(event.pubkey, new Set());
      }
      this.authorIndex.get(event.pubkey).add(event);
    }
  }

  // Holt ein Event anhand seiner ID
  getEventById(eventId) {
    return this.events.get(eventId);
  }

  // Filtert Events basierend auf übergebenen Kriterien
  getEventsByCriteria(criteria) {
    let filteredEvents = new Set(this.events.values());

    // Nutzen der Indizes für 'kinds' und 'authors'
    if (criteria.kinds) {
      filteredEvents = new Set(
        criteria.kinds.flatMap(kind => Array.from(this.kindIndex.get(kind) || []))
      );
    }
    if (criteria.authors) {
      const authorFiltered = new Set(
        criteria.authors.flatMap(author => Array.from(this.authorIndex.get(author) || []))
      );
      filteredEvents = new Set([...filteredEvents].filter(event => authorFiltered.has(event)));
    }

    // Für Tags und weitere Filter den reduzierten Event-Satz durchsuchen
    if (criteria.tags) {
      filteredEvents = new Set([...filteredEvents].filter(event =>
        this.matchesCriteria(event, criteria)
      ));
    }

    return Array.from(filteredEvents);
  }

  // Hilfsmethode zur Überprüfung der Kriterienübereinstimmung
  matchesCriteria(event, criteria) {
    for (let key in criteria) {
      if (key === 'kinds' && !criteria.kinds.includes(event.kind)) {
        return false;
      }

      if (key === 'authors' && !criteria.authors.includes(event.pubkey)) {
        return false;
      }

      if (criteria.tags) {
        for (let tagKey in criteria.tags) {
          const tagValues = event.tags.filter(tag => tag[0] === tagKey).map(tag => tag[1]);
          // Überprüft, ob jeder Wert im Filter auch in der Tag-Liste ist
          if (!criteria.tags[tagKey].some(value => tagValues.includes(value))) {
            return false;
          }
        }
      }
    }

    return true;
  }
}

// Erstellt einen Svelte Store mit einer Instanz von NostrEventCache
const cache = new NostrEventCache();
export const nostrCache = writable(cache);

// Beispiel für eine Exportmethode, um ein Event hinzuzufügen oder zu aktualisieren
export const addOrUpdateEvent = (event) => {
  nostrCache.update(cache => {
    cache.addOrUpdateEvent(event);
    return cache;
  });
};

// Beispiel für eine Exportmethode, um Events nach Kriterien zu filtern
export const getEventsByCriteria = (criteria) => {
  let filteredEvents;
  nostrCache.subscribe(cache => {
    filteredEvents = cache.getEventsByCriteria(criteria);
  })();
  return filteredEvents;
};
