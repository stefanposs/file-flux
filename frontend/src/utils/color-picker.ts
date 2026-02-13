// Vereinfachte Version ohne externe Abhängigkeiten
export function initColorPicker() {
  console.log('Nativer Farbwähler wird initialisiert...');
  
  // Warte, bis das DOM vollständig geladen ist
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(setupColorPickerElements, 1);
  } else {
    document.addEventListener('DOMContentLoaded', setupColorPickerElements);
  }
}

function setupColorPickerElements() {
  // Suche nach Elementen mit der Klasse 'color-picker'
  const colorPickerElements = document.querySelectorAll('.color-picker');
  
  colorPickerElements.forEach(element => {
    if (element instanceof HTMLInputElement) {
      // Stelle sicher, dass es sich um ein Input-Element handelt
      element.type = 'color';
      
      // Füge ein Label hinzu, wenn keines vorhanden ist
      const parentElement = element.parentElement;
      if (parentElement && !parentElement.querySelector('label')) {
        const label = document.createElement('label');
        label.textContent = element.getAttribute('data-label') || 'Farbauswahl:';
        label.setAttribute('for', element.id || '');
        parentElement.insertBefore(label, element);
      }
    }
  });
  
  console.log(`${colorPickerElements.length} Farbwähler wurden initialisiert`);
} 