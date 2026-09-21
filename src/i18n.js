const nl={
  'Rehearsal room':'Repetitieruimte','Rehearsal rooms':'Repetitieruimtes','New rehearsal room':'Nieuwe repetitieruimte',
  'New room':'Nieuwe ruimte','Dark mode':'Donkere modus','Toggle dark mode':'Donkere modus wisselen','Automatic':'Automatisch',
  'Room settings':'Ruimte-instellingen','Back up room':'Ruimte back-uppen','Publish website':'Website publiceren','Update website':'Website bijwerken',
  'Help':'Hulp','Language':'Taal','English':'Engels','Dutch':'Nederlands','All pieces':'Alle stukken','New folder':'Nieuwe map','Manage folders':'Mappen beheren',
  'Search pieces or tags':'Zoek stukken of labels','All folders':'Alle mappen','All visibility':'Alle zichtbaarheid','Visible':'Zichtbaar','Hidden':'Verborgen','Locked':'Beveiligd',
  'Sort: custom order':'Sortering: eigen volgorde','Title A–Z':'Titel A–Z','Composer A–Z':'Componist A–Z','Newest first':'Nieuwste eerst','Folder A–Z':'Map A–Z',
  'Import scores':'Partituren importeren','Recently removed':'Recent verwijderd','No matching pieces':'Geen overeenkomende stukken','Add your first score':'Voeg je eerste partituur toe',
  'Open':'Openen','Unlock':'Ontgrendelen','Settings':'Instellingen','Parts':'Partijen','bars':'maten','Select all shown pieces':'Selecteer alle getoonde stukken',
  'Back to the room':'Terug naar de ruimte','Piece settings':'Stukinstellingen','Export HTML':'HTML exporteren','My practice':'Mijn repetitie',
  'Show':'Toon','Full score':'Volledige partituur','Follow score':'Volg partituur','Select loop':'Herhaling kiezen','Bars':'Maten','Fit':'Passend','Print':'Afdrukken',
  'Speed':'Tempo','Pitch':'Toonhoogte','original':'origineel','Count-in':'Aftellen','Repeats':'Herhalingen','Download WAV':'WAV downloaden',
  'Go to bar':'Ga naar maat','Loop bars':'Herhaal maten','to':'tot','Loop off':'Herhaling uit','Reset mix':'Mix herstellen','Edit parts':'Partijen bewerken',
  'Voice':'Stem','Instrument':'Instrument','Focus':'Focus','Centre':'Midden','Left':'Links','Right':'Rechts','Vertical':'Verticaal','Sideways':'Zijwaarts',
  'Password protected':'Met wachtwoord','Password':'Wachtwoord','Set or change password':'Wachtwoord instellen of wijzigen','Shared room password':'Gedeeld wachtwoord voor de ruimte',
  'Separate password for this piece':'Apart wachtwoord voor dit stuk','Share this password with your singers.':'Deel dit wachtwoord met je zangers.',
  'Remove piece':'Stuk verwijderen','Cancel':'Annuleren','Save':'Opslaan','Close':'Sluiten','Create':'Aanmaken','Folder':'Map','Title':'Titel','Composer':'Componist',
  'Edit piece':'Stuk bewerken','Edit folder':'Map bewerken','Colour':'Kleur','Remove folder':'Map verwijderen','Save parts':'Partijen opslaan','Publish':'Publiceren',
  'Parts in the practice website':'Partijen op de oefenwebsite','Edit published parts, sounds and doubling':'Gepubliceerde partijen, klanken en verdubbeling bewerken',
  'Default speed':'Standaardtempo','Default score direction':'Standaardrichting partituur','Join when resting':'Meezingen tijdens rust','Joined line':'Meegezongen partij',
  'None':'Geen','Original octave':'Oorspronkelijk octaaf','One octave lower':'Een octaaf lager','One octave higher':'Een octaaf hoger','Accompaniment':'Begeleiding',
  'Website visibility':'Zichtbaarheid op website','Tags, separated by commas':'Labels, gescheiden door komma’s','Folder colour':'Mapkleur','Shared rehearsal notes':'Gedeelde repetitienotities',
  'Practice settings are saved in this browser.':'Repetitie-instellingen worden in deze browser bewaard.','Not started':'Niet begonnen','Learning':'Aan het leren','Confident':'Zeker',
  'Learning progress · this browser only':'Leervoortgang · alleen in deze browser','Private notes':'Privénotities','Preparing your score…':'Partituur voorbereiden…',
  'Scroll':'Bladeren','Score scrolling direction':'Bladerrichting van partituur','Show score part':'Toon partij','Play or pause':'Afspelen of pauzeren','Restart':'Opnieuw',
  'Rehearsal room settings':'Instellingen repetitieruimte','Room name':'Naam van ruimte','Welcome message':'Welkomstbericht','Website language':'Taal van website',
  'Save changes':'Wijzigingen opslaan','Create folder':'Map aanmaken','Folder name':'Naam van map','Remove':'Verwijderen','Done':'Klaar','Restore':'Herstellen',
  'Sharing password':'Wachtwoord om te delen','Use password':'Wachtwoord gebruiken','Open piece':'Stuk openen','Optional sharing protection. Share the password with your singers.':'Optionele bescherming voor delen. Deel het wachtwoord met je zangers.',
  'Tag colour':'Labelkleur','Sort pieces':'Stukken sorteren','Visibility':'Zichtbaarheid',
  'Search pieces':'Stukken zoeken','Folders':'Mappen','Go':'Ga','Loop on':'Herhaling aan','Choose first bar':'Kies de eerste maat','Choose last bar':'Kies de laatste maat',
  'App source & licence':'Broncode en licentie','Guide & shortcuts':'Handleiding en sneltoetsen','Prepare':'Voorbereiden','Practise':'Oefenen','Organise and share':'Ordenen en delen','Local saving':'Lokaal opslaan','Check for updates':'Controleren op updates'
};
export function translate(root,language='en'){
  document.documentElement.lang=language;
  if(language!=='nl')return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){
    const raw=node.nodeValue,trim=raw.trim();if(!trim)continue;
    let value=nl[trim];
    if(!value)value=trim.replace(/\bbars\b/g,'maten').replace(/\bparts\b/g,'partijen').replace(/ selected$/,' geselecteerd');
    if(value!==trim)node.nodeValue=raw.replace(trim,value);
  }
  root.querySelectorAll('[placeholder]').forEach(el=>{if(nl[el.placeholder])el.placeholder=nl[el.placeholder];});
  root.querySelectorAll('[aria-label]').forEach(el=>{if(nl[el.getAttribute('aria-label')])el.setAttribute('aria-label',nl[el.getAttribute('aria-label')]);});
  root.querySelectorAll('[title]').forEach(el=>{if(nl[el.title])el.title=nl[el.title];});
}
