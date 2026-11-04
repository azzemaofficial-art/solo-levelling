import React from 'react';
import { ArrowRight } from 'lucide-react';
import ProtocolIcon from './ProtocolIcon';

// Scheda con le alternative di un pasto (settimane 7–16): stesse calorie e proteine simili, vedi alternativesFor.
export default function MealAlternatives({ slot, dishes, plannedTitle, missingImages, onImageMissing, onPick, onReset, onOpen, onClose }) {
  return (
    <div className="cut-modal-backdrop" onClick={onClose}>
      <div className="cut-modal" role="dialog" aria-modal="true" aria-labelledby="cut-alt-title" onClick={(e) => e.stopPropagation()}>
        <button className="cut-close" onClick={onClose}>Chiudi</button>
        <small>{slot.label}</small>
        <h2 id="cut-alt-title">{dishes.length} alternative</h2>
        <p className="cut-fine">Stesse calorie (±60 kcal), proteine simili e dosi già calcolate. Scegline una: entra nel piano solo per questo pasto.</p>
        {slot.swapReason === 'scelta' && <button type="button" className="cut-alt-reset" onClick={onReset}>Torna a {plannedTitle}</button>}
        <ul className="cut-alts">
          {dishes.map((dish) => (
            <li key={dish.id} className={dish.id === slot.id ? 'on' : ''}>
              <button type="button" className="cut-alt-choose" onClick={() => onPick(dish.id)} aria-label={`Scegli ${dish.title}`}>
                {missingImages[dish.image] ? <i aria-hidden="true"><ProtocolIcon name="food" size={26} /></i> : <img src={dish.image} alt="" loading="lazy" onError={() => onImageMissing(dish.image)} />}
                <span><b>{dish.title}</b><small>{dish.cuisine} · ≈ {dish.kcal} kcal · {dish.protein} g proteine{dish.whey ? ' · 🍫 cioccolato-wafer' : ''}</small><em>{dish.why}</em></span>
              </button>
              <button type="button" className="cut-alt-recipe" onClick={() => onOpen(dish)} aria-label={`Ricetta di ${dish.title}`}><ArrowRight size={16} /></button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
