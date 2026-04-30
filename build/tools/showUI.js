// ─── Server-side render helpers ───────────────────────────────────────────
function workoutBadge(type) {
    const map = {
        gym: { icon: '🏋️', label: 'Gym Day', color: '#f97316' },
        running: { icon: '🏃', label: 'Run Day', color: '#3b82f6' },
        rest: { icon: '😴', label: 'Rest Day', color: '#6b7280' },
    };
    return map[type] ?? map['rest'];
}
function cuisineFlag(cuisine) {
    const map = { indian: '🇮🇳', chinese: '🇨🇳', italian: '🇮🇹' };
    return map[cuisine] ?? '🍽️';
}
function spiceDots(level) {
    const filled = level === 'hot' ? 3 : level === 'medium' ? 2 : 1;
    return Array.from({ length: 3 }, (_, i) => `<span class="spice-dot ${i < filled ? 'filled' : ''}">🌶</span>`).join('');
}
function tagsHtml(tags) {
    return tags.slice(0, 3).map(t => `<span class="tag">${t.replace(/-/g, ' ')}</span>`).join('');
}
function mealCardHtml(meal, dayName, mealType) {
    const extraIngCount = meal.ingredients.length - 3;
    return `
  <div class="meal-card" id="card-${dayName}-${mealType}" data-id="${meal.id}" data-day="${dayName}" data-type="${mealType}">
    <div class="mc-top">
      <span class="mc-emoji">${meal.emoji}</span>
      <div class="mc-flags">
        <span>${cuisineFlag(meal.cuisine)}</span>
        <span class="mc-spice">${spiceDots(meal.spiceLevel)}</span>
      </div>
    </div>
    <div class="mc-name">${meal.name}</div>
    <div class="mc-desc">${meal.description}</div>
    <div class="mc-macros">
      <span class="mc-stat">⚡ ${meal.macros.calories}</span>
      <span class="mc-stat protein">💪 ${meal.macros.protein}g</span>
      <span class="mc-stat">⏱ ${meal.prepTime}m</span>
    </div>
    <div class="mc-ingredients">
      ${meal.ingredients.slice(0, 3).map(i => `<span class="ing">${i}</span>`).join('')}${extraIngCount > 0 ? `<span class="ing more">+${extraIngCount}</span>` : ''}
    </div>
    <div class="mc-tags">${tagsHtml(meal.tags)}</div>
    <div class="mc-actions">
      <button class="btn-shuffle" onclick="shuffleMeal('${dayName}','${mealType}','${meal.id}')">🔀 Shuffle</button>
      <button class="btn-detail" onclick="showDetail('${meal.id}','${dayName}','${mealType}')">📋 Details</button>
    </div>
  </div>`;
}
function dayCardHtml(plan, dayName) {
    const day = plan.days[dayName];
    if (!day)
        return '';
    const badge = workoutBadge(day.workoutType);
    const pctCal = Math.min(100, Math.round((day.totalCalories / day.calorieTarget) * 100));
    const pctPro = Math.min(100, Math.round((day.totalProtein / day.proteinTarget) * 100));
    return `
  <div class="day-card">
    <div class="day-header">
      <div class="day-name-row">
        <span class="day-name">${dayName}</span>
        <span class="day-date">${day.date}</span>
      </div>
      <div class="workout-badge" style="background:${badge.color}18;color:${badge.color};border-color:${badge.color}35">
        ${badge.icon} ${badge.label}
      </div>
      <div class="day-macros">
        <div class="macro-bar-row">
          <span>Calories</span>
          <div class="bar"><div class="fill cal-fill" style="width:${pctCal}%"></div></div>
          <span class="macro-val">${day.totalCalories} / ${day.calorieTarget}</span>
        </div>
        <div class="macro-bar-row">
          <span>Protein</span>
          <div class="bar"><div class="fill pro-fill" style="width:${pctPro}%"></div></div>
          <span class="macro-val">${day.totalProtein}g / ${day.proteinTarget}g</span>
        </div>
      </div>
    </div>
    <div class="meals-row">
      <div class="meal-col">
        <div class="meal-type-label breakfast-label">🌅 Breakfast</div>
        ${mealCardHtml(day.breakfast, dayName, 'breakfast')}
      </div>
      <div class="meal-col">
        <div class="meal-type-label lunch-label">☀️ Lunch</div>
        ${mealCardHtml(day.lunch, dayName, 'lunch')}
      </div>
      <div class="meal-col">
        <div class="meal-type-label dinner-label">🌙 Dinner</div>
        ${mealCardHtml(day.dinner, dayName, 'dinner')}
      </div>
    </div>
  </div>`;
}
// ─── Main export ──────────────────────────────────────────────────────────
export function generateDashboardHTML(plan, recipeBank = []) {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const allDays = Object.values(plan.days);
    const avgCal = Math.round(allDays.reduce((s, d) => s + d.totalCalories, 0) / allDays.length);
    const avgPro = Math.round(allDays.reduce((s, d) => s + d.totalProtein, 0) / allDays.length);
    const totalMeals = allDays.length * 3;
    const cuisineCount = { indian: 0, chinese: 0, italian: 0 };
    allDays.forEach(d => [d.breakfast, d.lunch, d.dinner].forEach(m => { cuisineCount[m.cuisine] = (cuisineCount[m.cuisine] || 0) + 1; }));
    const profile = plan.userProfile;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Weekly Meal Planner</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700;900&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:         #0d0b08;
    --surface:    #141210;
    --card:       #1c1714;
    --card-hover: #22201a;
    --border:     #2a2420;
    --border2:    #352e26;
    --primary:    #f59e0b;
    --primary-d:  #d97706;
    --protein:    #10b981;
    --carb:       #3b82f6;
    --spice:      #ef4444;
    --text:       #f0e6d3;
    --text2:      #9e8a72;
    --text3:      #5a4a38;
    --font-h:     'Fraunces', serif;
    --font-b:     'Plus Jakarta Sans', sans-serif;
    --r:          12px;
    --r-sm:       7px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: var(--font-b); min-height: 100vh; line-height: 1.5; }

  /* ── Header ── */
  .header {
    background: linear-gradient(160deg, #1c1409 0%, #0d0b08 55%);
    border-bottom: 1px solid var(--border);
    padding: 20px 28px 0;
    position: sticky; top: 0; z-index: 100;
    backdrop-filter: blur(14px);
  }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
  .app-title { font-family: var(--font-h); font-size: 24px; font-weight: 700; color: var(--primary); letter-spacing: -.5px; }
  .app-sub { font-size: 11px; color: var(--text2); margin-top: 2px; }
  .week-badge {
    background: #f59e0b18; color: var(--primary);
    border: 1px solid #f59e0b30; border-radius: 20px;
    padding: 4px 14px; font-size: 12px; font-weight: 600;
  }
  .stats-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .stat-pill {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 7px 14px;
    display: flex; flex-direction: column; gap: 1px;
  }
  .stat-pill .val { font-family: var(--font-h); font-size: 18px; font-weight: 700; }
  .stat-pill .lbl { font-size: 10px; color: var(--text2); text-transform: uppercase; letter-spacing: .5px; }
  .cuisine-pills { display: flex; gap: 6px; align-items: center; }
  .cuisine-pill { padding: 4px 10px; border-radius: 7px; font-size: 11px; font-weight: 600; }

  /* ── Tabs ── */
  .tabs { display: flex; gap: 0; border-top: 1px solid var(--border); margin: 0 -28px; }
  .tab-btn {
    flex: 1; padding: 11px 0; background: none; border: none;
    color: var(--text2); font-family: var(--font-b); font-size: 13px;
    font-weight: 600; cursor: pointer; transition: all .15s;
    border-top: 2px solid transparent; margin-top: -1px;
  }
  .tab-btn:hover { color: var(--text); }
  .tab-btn.active { color: var(--primary); border-top-color: var(--primary); }

  /* ── Tab content ── */
  .tab-content { display: none; }
  .tab-content.active { display: block; }

  /* ── Main layout ── */
  .content { padding: 20px 28px; max-width: 1400px; margin: 0 auto; }

  /* ── Day card ── */
  .plan-list { display: flex; flex-direction: column; gap: 14px; }
  .day-card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: var(--r); overflow: hidden;
    transition: border-color .2s;
  }
  .day-card:hover { border-color: #f59e0b30; }
  .day-header {
    padding: 14px 18px;
    background: linear-gradient(to right, #1f1a0e, var(--card));
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  }
  .day-name-row { display: flex; flex-direction: column; min-width: 88px; }
  .day-name { font-family: var(--font-h); font-size: 17px; font-weight: 700; }
  .day-date { font-size: 10px; color: var(--text3); }
  .workout-badge { border: 1px solid; border-radius: 20px; padding: 3px 11px; font-size: 12px; font-weight: 600; white-space: nowrap; }
  .day-macros { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 5px; }
  .macro-bar-row { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--text2); }
  .macro-bar-row span:first-child { width: 52px; flex-shrink: 0; }
  .bar { flex: 1; height: 4px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .fill { height: 100%; border-radius: 3px; transition: width .6s ease; }
  .cal-fill { background: var(--primary); }
  .pro-fill  { background: var(--protein); }
  .macro-val { font-size: 10px; color: var(--text3); min-width: 80px; text-align: right; }

  /* ── Meals row ── */
  .meals-row { display: grid; grid-template-columns: 1fr 1fr 1fr; }
  .meal-col { border-right: 1px solid var(--border); }
  .meal-col:last-child { border-right: none; }
  .meal-type-label {
    padding: 7px 14px 5px; font-size: 10px; font-weight: 700;
    letter-spacing: .8px; text-transform: uppercase;
    border-bottom: 1px solid var(--border);
  }
  .breakfast-label { color: #fbbf24; background: #fbbf2406; }
  .lunch-label     { color: #f97316; background: #f9731606; }
  .dinner-label    { color: #818cf8; background: #818cf806; }

  /* ── Meal card ── */
  .meal-card { padding: 12px 14px; transition: background .15s; }
  .meal-card:hover { background: var(--card-hover); }
  .mc-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
  .mc-emoji { font-size: 20px; }
  .mc-flags { display: flex; align-items: center; gap: 5px; font-size: 14px; }
  .mc-spice { font-size: 9px; letter-spacing: -2px; }
  .mc-name { font-family: var(--font-h); font-size: 13px; font-weight: 600; line-height: 1.3; margin-bottom: 4px; }
  .mc-desc { font-size: 11px; color: var(--text2); line-height: 1.45; margin-bottom: 7px; }
  .mc-macros { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 7px; }
  .mc-stat {
    font-size: 10px; color: var(--text2);
    background: var(--surface); border: 1px solid var(--border);
    padding: 2px 6px; border-radius: 5px;
  }
  .mc-stat.protein { color: var(--protein); border-color: #10b98128; }
  .mc-ingredients { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
  .ing {
    font-size: 10px; color: var(--text3);
    background: var(--surface); border: 1px solid var(--border);
    padding: 2px 6px; border-radius: 4px;
  }
  .ing.more { color: var(--primary); border-color: #f59e0b28; }
  .mc-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
  .tag {
    font-size: 9px; color: var(--text3);
    background: var(--surface); border: 1px solid var(--border2);
    padding: 1px 6px; border-radius: 3px; text-transform: uppercase; letter-spacing: .4px;
  }
  .mc-actions { display: flex; gap: 5px; }
  .btn-shuffle, .btn-detail {
    flex: 1; padding: 5px 0;
    border: 1px solid var(--border); border-radius: var(--r-sm);
    background: var(--surface); color: var(--text2);
    font-size: 10px; font-family: var(--font-b); font-weight: 600;
    cursor: pointer; transition: all .15s;
  }
  .btn-shuffle:hover { background: #f59e0b12; border-color: #f59e0b40; color: var(--primary); }
  .btn-detail:hover  { background: #3b82f612; border-color: #3b82f640; color: var(--carb); }

  /* ── Shopping List ── */
  .shopping-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
  .shopping-title { font-family: var(--font-h); font-size: 22px; font-weight: 700; }
  .btn-copy {
    background: var(--card); border: 1px solid var(--border);
    color: var(--text2); padding: 8px 16px; border-radius: 8px;
    font-family: var(--font-b); font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all .15s;
  }
  .btn-copy:hover { border-color: var(--primary); color: var(--primary); }
  .shopping-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
  .shop-category {
    background: var(--card); border: 1px solid var(--border);
    border-radius: var(--r); padding: 14px;
  }
  .shop-cat-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .7px; color: var(--primary); margin-bottom: 10px; }
  .shop-item { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--border); }
  .shop-item:last-child { border-bottom: none; }
  .shop-item input[type=checkbox] { accent-color: var(--primary); width: 14px; height: 14px; cursor: pointer; }
  .shop-item label { font-size: 12px; color: var(--text2); cursor: pointer; flex: 1; }
  .shop-item .shop-count { font-size: 10px; color: var(--text3); }

  /* ── Settings ── */
  .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media(max-width: 700px) { .settings-grid { grid-template-columns: 1fr; } }
  .settings-section {
    background: var(--card); border: 1px solid var(--border);
    border-radius: var(--r); padding: 18px;
  }
  .settings-section-title {
    font-family: var(--font-h); font-size: 15px; font-weight: 700;
    margin-bottom: 14px; color: var(--text);
  }
  .schedule-grid { display: flex; flex-direction: column; gap: 8px; }
  .schedule-row { display: flex; align-items: center; gap: 8px; }
  .schedule-day { width: 84px; font-size: 12px; color: var(--text2); }
  .type-btns { display: flex; gap: 5px; }
  .type-btn {
    padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);
    background: var(--surface); color: var(--text3); font-size: 11px;
    font-family: var(--font-b); font-weight: 600; cursor: pointer; transition: all .15s;
  }
  .type-btn.active-gym     { background: #f9731618; border-color: #f9731640; color: #f97316; }
  .type-btn.active-running { background: #3b82f618; border-color: #3b82f640; color: #3b82f6; }
  .type-btn.active-rest    { background: #6b728018; border-color: #6b728040; color: #9ca3af; }
  .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .metric-field label { display: block; font-size: 11px; color: var(--text2); margin-bottom: 5px; text-transform: uppercase; letter-spacing: .5px; }
  .metric-field input {
    width: 100%; background: var(--surface); border: 1px solid var(--border2);
    border-radius: 8px; padding: 8px 12px; color: var(--text);
    font-family: var(--font-b); font-size: 14px;
  }
  .metric-field input:focus { outline: none; border-color: var(--primary); }
  .targets-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .target-row { display: flex; justify-content: space-between; font-size: 12px; }
  .target-row span:first-child { color: var(--text2); }
  .target-row span:last-child  { color: var(--text); font-weight: 600; }
  .btn-save-settings {
    margin-top: 16px; width: 100%; padding: 10px;
    background: var(--primary); border: none; border-radius: 8px;
    color: #0d0b08; font-family: var(--font-b); font-size: 13px; font-weight: 700;
    cursor: pointer; transition: background .15s;
  }
  .btn-save-settings:hover { background: var(--primary-d); }
  .settings-note {
    margin-top: 20px; padding: 12px 16px;
    background: #f59e0b0a; border: 1px solid #f59e0b25;
    border-radius: 8px; font-size: 12px; color: var(--text2); line-height: 1.6;
  }
  .settings-note code { background: var(--surface); padding: 1px 5px; border-radius: 4px; color: var(--primary); font-size: 11px; }

  /* ── Modal ── */
  .modal-overlay {
    display: none; position: fixed; inset: 0;
    background: #00000095; backdrop-filter: blur(6px);
    z-index: 999; justify-content: center; align-items: center;
  }
  .modal-overlay.open { display: flex; }
  .modal {
    background: var(--card); border: 1px solid var(--border2);
    border-radius: 18px; padding: 26px; max-width: 440px; width: 92%;
    max-height: 82vh; overflow-y: auto;
    animation: slideUp .2s ease;
  }
  @keyframes slideUp { from { transform: translateY(18px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .modal-title { font-family: var(--font-h); font-size: 20px; font-weight: 700; margin-bottom: 14px; color: var(--primary); }
  .modal-section { margin-bottom: 14px; }
  .modal-label { font-size: 10px; text-transform: uppercase; letter-spacing: .8px; color: var(--text3); margin-bottom: 5px; }
  .modal-value { font-size: 13px; color: var(--text2); line-height: 1.6; }
  .macros-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .macro-box { background: var(--surface); border: 1px solid var(--border); border-radius: 9px; padding: 9px; text-align: center; }
  .macro-box .val { font-family: var(--font-h); font-size: 16px; font-weight: 700; }
  .macro-box .unit { font-size: 10px; color: var(--text3); }
  .tag-list { display: flex; flex-wrap: wrap; gap: 5px; }
  .modal-tag { background: var(--surface); border: 1px solid var(--border); border-radius: 5px; padding: 3px 8px; font-size: 11px; color: var(--text2); }
  .btn-close {
    width: 100%; margin-top: 14px; padding: 10px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 9px; color: var(--text2);
    font-family: var(--font-b); font-size: 13px; cursor: pointer;
  }
  .btn-close:hover { border-color: var(--spice); color: var(--spice); }

  /* ── Toast ── */
  .toast {
    position: fixed; bottom: 22px; right: 22px;
    background: #162616; border: 1px solid #10b98140;
    color: #10b981; padding: 10px 18px; border-radius: 9px;
    font-size: 12px; font-weight: 600; z-index: 9999;
    opacity: 0; transform: translateY(8px);
    transition: all .25s ease; pointer-events: none;
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.error { background: #1e1010; border-color: #ef444440; color: #ef4444; }

  /* ── Chat ── */
  .chat-wrap { display: flex; flex-direction: column; height: calc(100vh - 180px); min-height: 400px; }
  .chat-messages {
    flex: 1; overflow-y: auto; padding: 16px 0; display: flex;
    flex-direction: column; gap: 10px;
    scrollbar-width: thin; scrollbar-color: var(--border) transparent;
  }
  .chat-msg { display: flex; gap: 10px; max-width: 78%; }
  .chat-msg.user     { align-self: flex-end; flex-direction: row-reverse; }
  .chat-msg.assistant { align-self: flex-start; }
  .chat-bubble {
    padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.55;
    white-space: pre-wrap; word-break: break-word;
  }
  .chat-msg.user .chat-bubble {
    background: var(--primary); color: #0d0b08; border-bottom-right-radius: 4px; font-weight: 500;
  }
  .chat-msg.assistant .chat-bubble {
    background: var(--card); border: 1px solid var(--border); color: var(--text);
    border-bottom-left-radius: 4px;
  }
  .chat-msg.loading .chat-bubble { color: var(--text2); font-style: italic; }
  .chat-quick { display: flex; gap: 7px; flex-wrap: wrap; padding: 10px 0 12px; border-top: 1px solid var(--border); }
  .quick-btn {
    background: var(--card); border: 1px solid var(--border2);
    color: var(--text2); padding: 5px 12px; border-radius: 20px;
    font-size: 11px; font-family: var(--font-b); cursor: pointer; transition: all .15s;
    white-space: nowrap;
  }
  .quick-btn:hover { border-color: var(--primary); color: var(--primary); }
  .chat-input-row { display: flex; gap: 8px; padding-top: 4px; }
  .chat-input {
    flex: 1; background: var(--card); border: 1px solid var(--border2);
    border-radius: 10px; padding: 10px 14px; color: var(--text);
    font-family: var(--font-b); font-size: 13px;
  }
  .chat-input:focus { outline: none; border-color: var(--primary); }
  .chat-send {
    background: var(--primary); border: none; border-radius: 10px;
    color: #0d0b08; font-family: var(--font-b); font-size: 13px;
    font-weight: 700; padding: 10px 18px; cursor: pointer; transition: background .15s;
    white-space: nowrap;
  }
  .chat-send:hover { background: var(--primary-d); }
  .chat-send:disabled { opacity: .5; cursor: default; }
  .chat-offline {
    text-align: center; padding: 32px 20px;
    background: var(--card); border: 1px solid var(--border); border-radius: var(--r);
    color: var(--text2); font-size: 13px; line-height: 1.8;
  }
  .chat-offline code { color: var(--primary); background: var(--surface); padding: 2px 7px; border-radius: 5px; font-size: 12px; }

  /* ── Responsive ── */
  @media(max-width: 820px) {
    .meals-row { grid-template-columns: 1fr; }
    .meal-col { border-right: none; border-bottom: 1px solid var(--border); }
    .meal-col:last-child { border-bottom: none; }
    .header { padding: 16px 16px 0; }
    .tabs { margin: 0 -16px; }
    .content { padding: 16px; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-top">
    <div>
      <div class="app-title">🍽️ Meal Planner</div>
      <div class="app-sub">Vegetarian · Protein-Rich · Workout-Aware${profile.weight ? ` · ${profile.weight}kg` : ''}${profile.height ? ` · ${profile.height}cm` : ''}</div>
    </div>
    <span class="week-badge">Week ${plan.weekId}</span>
  </div>
  <div class="stats-row">
    <div class="stat-pill">
      <span class="val">${avgCal}</span>
      <span class="lbl">Avg kcal/day</span>
    </div>
    <div class="stat-pill">
      <span class="val" style="color:var(--protein)">${avgPro}g</span>
      <span class="lbl">Avg protein/day</span>
    </div>
    <div class="stat-pill">
      <span class="val">${totalMeals}</span>
      <span class="lbl">Total meals</span>
    </div>
    <div class="stat-pill">
      <div class="cuisine-pills">
        <span class="cuisine-pill" style="background:#f59e0b14;color:#f59e0b">🇮🇳 ${cuisineCount['indian'] || 0}</span>
        <span class="cuisine-pill" style="background:#ef444414;color:#ef4444">🇨🇳 ${cuisineCount['chinese'] || 0}</span>
        <span class="cuisine-pill" style="background:#3b82f614;color:#3b82f6">🇮🇹 ${cuisineCount['italian'] || 0}</span>
      </div>
      <span class="lbl" style="margin-top:4px">Cuisine mix</span>
    </div>
  </div>
  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('plan',this)">📅 Week Plan</button>
    <button class="tab-btn" onclick="switchTab('shopping',this)">🛒 Shopping List</button>
    <button class="tab-btn" onclick="switchTab('settings',this)">⚙️ Settings</button>
    <button class="tab-btn" onclick="switchTab('chat',this)">💬 Ask AI</button>
  </div>
</div>

<!-- ── Plan tab ── -->
<div id="tab-plan" class="tab-content active">
  <div class="content">
    <div class="plan-list">
      ${DAYS.map(d => dayCardHtml(plan, d)).join('\n')}
    </div>
  </div>
</div>

<!-- ── Shopping tab ── -->
<div id="tab-shopping" class="tab-content">
  <div class="content">
    <div class="shopping-header">
      <div class="shopping-title">🛒 Shopping List</div>
      <button class="btn-copy" onclick="copyShoppingList()">📋 Copy All</button>
    </div>
    <div id="shopping-grid" class="shopping-grid"></div>
  </div>
</div>

<!-- ── Settings tab ── -->
<div id="tab-settings" class="tab-content">
  <div class="content">
    <div class="settings-grid">
      <div class="settings-section">
        <div class="settings-section-title">🗓️ Workout Schedule</div>
        <div class="schedule-grid" id="schedule-grid"></div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">📏 Body Metrics</div>
        <div class="metrics-grid">
          <div class="metric-field">
            <label>Weight (kg)</label>
            <input type="number" id="input-weight" min="40" max="200" step="1" placeholder="70">
          </div>
          <div class="metric-field">
            <label>Height (cm)</label>
            <input type="number" id="input-height" min="140" max="220" step="1" placeholder="168">
          </div>
        </div>
        <div style="margin-top:16px">
          <div class="settings-section-title" style="font-size:13px;margin-bottom:8px">📊 Calculated Targets</div>
          <div class="targets-list" id="targets-list"></div>
        </div>
        <button class="btn-save-settings" onclick="saveSettings()">💾 Save &amp; Download settings.json</button>
      </div>
    </div>
    <div class="settings-note">
      💡 After saving, put <code>settings.json</code> in your <code>data/</code> folder and run <code>node preview.mjs</code> to regenerate the plan with your new settings.
    </div>
  </div>
</div>

<!-- ── Chat tab ── -->
<div id="tab-chat" class="tab-content">
  <div class="content">
    <div class="chat-wrap" id="chat-wrap">
      <div id="chat-messages" class="chat-messages"></div>
      <div class="chat-quick" id="chat-quick">
        <button class="quick-btn" onclick="usePrompt('What is my total protein this week?')">💪 Weekly protein total</button>
        <button class="quick-btn" onclick="usePrompt('Shuffle Monday lunch')">🔀 Shuffle Monday lunch</button>
        <button class="quick-btn" onclick="usePrompt('Which day has the best macros?')">📊 Best macro day</button>
        <button class="quick-btn" onclick="usePrompt('What should I eat on a gym day?')">🏋️ Gym day advice</button>
        <button class="quick-btn" onclick="usePrompt('What is in my Wednesday dinner?')">🍽️ Wednesday dinner</button>
        <button class="quick-btn" onclick="usePrompt('Am I hitting my protein targets?')">🎯 Protein targets</button>
      </div>
      <div class="chat-input-row">
        <input type="text" id="chat-input" class="chat-input"
          placeholder="Ask about your meal plan…"
          onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); sendChat(); }">
        <button class="chat-send" id="chat-send-btn" onclick="sendChat()">Send ↑</button>
      </div>
    </div>
  </div>
</div>

<!-- ── Detail Modal ── -->
<div class="modal-overlay" id="modal" onclick="if(event.target===this)closeModal()">
  <div class="modal" id="modal-content"></div>
</div>

<!-- ── Toast ── -->
<div class="toast" id="toast"></div>

<script>
  // ── Embedded data ────────────────────────────────────────────────────────
  const RECIPE_BANK_DATA = ${JSON.stringify(recipeBank)};
  const planData = ${JSON.stringify(plan)};

  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  // ── Tab switching ────────────────────────────────────────────────────────
  function switchTab(name, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    if (btn) btn.classList.add('active');
    if (name === 'shopping') renderShoppingList();
    if (name === 'settings') initSettingsUI();
    if (name === 'chat') initChat();
  }

  // ── Client-side shuffle ──────────────────────────────────────────────────
  function shuffleMeal(day, mealType, currentId) {
    if (!RECIPE_BANK_DATA.length) {
      showToast('Shuffle requires the recipe bank — open via node preview.mjs', true);
      return;
    }
    const pool = RECIPE_BANK_DATA.filter(r => r.mealType.includes(mealType) && r.id !== currentId);
    if (!pool.length) { showToast('No alternatives found', true); return; }
    const recipe = pool[Math.floor(Math.random() * pool.length)];
    planData.days[day][mealType] = recipe;
    const cardEl = document.getElementById('card-' + day + '-' + mealType);
    if (cardEl) cardEl.outerHTML = buildMealCardHtml(recipe, day, mealType);
    showToast('🔀 ' + day + ' ' + mealType + ' → ' + recipe.name);
  }

  function buildMealCardHtml(meal, day, mealType) {
    const flags = { indian:'🇮🇳', chinese:'🇨🇳', italian:'🇮🇹' };
    const extra = meal.ingredients.length - 3;
    const spice = meal.spiceLevel === 'hot' ? '🌶🌶🌶' : meal.spiceLevel === 'medium' ? '🌶🌶' : '🌶';
    const tags = meal.tags.slice(0,3).map(t => '<span class="tag">' + t.replace(/-/g,' ') + '</span>').join('');
    const ings = meal.ingredients.slice(0,3).map(i => '<span class="ing">' + i + '</span>').join('');
    const moreIng = extra > 0 ? '<span class="ing more">+' + extra + '</span>' : '';
    return \`<div class="meal-card" id="card-\${day}-\${mealType}" data-id="\${meal.id}" data-day="\${day}" data-type="\${mealType}">
      <div class="mc-top">
        <span class="mc-emoji">\${meal.emoji}</span>
        <div class="mc-flags"><span>\${flags[meal.cuisine]||'🍽️'}</span><span class="mc-spice" style="font-size:9px;letter-spacing:-2px">\${spice}</span></div>
      </div>
      <div class="mc-name">\${meal.name}</div>
      <div class="mc-desc">\${meal.description}</div>
      <div class="mc-macros">
        <span class="mc-stat">⚡ \${meal.macros.calories}</span>
        <span class="mc-stat protein">💪 \${meal.macros.protein}g</span>
        <span class="mc-stat">⏱ \${meal.prepTime}m</span>
      </div>
      <div class="mc-ingredients">\${ings}\${moreIng}</div>
      <div class="mc-tags">\${tags}</div>
      <div class="mc-actions">
        <button class="btn-shuffle" onclick="shuffleMeal('\${day}','\${mealType}','\${meal.id}')">🔀 Shuffle</button>
        <button class="btn-detail" onclick="showDetail('\${meal.id}','\${day}','\${mealType}')">📋 Details</button>
      </div>
    </div>\`;
  }

  // ── Detail modal ─────────────────────────────────────────────────────────
  function showDetail(recipeId, day, mealType) {
    let recipe = null;
    for (const d of Object.values(planData.days)) {
      for (const t of ['breakfast','lunch','dinner']) {
        if (d[t] && d[t].id === recipeId) { recipe = d[t]; break; }
      }
      if (recipe) break;
    }
    if (!recipe) return;
    const modal = document.getElementById('modal-content');
    modal.innerHTML = \`
      <div class="modal-title">\${recipe.emoji} \${recipe.name}</div>
      <div class="modal-section">
        <div class="modal-label">Description</div>
        <div class="modal-value">\${recipe.description}</div>
      </div>
      <div class="modal-section">
        <div class="modal-label">Nutrition</div>
        <div class="macros-grid">
          <div class="macro-box"><div class="val" style="color:var(--primary)">\${recipe.macros.calories}</div><div class="unit">kcal</div></div>
          <div class="macro-box"><div class="val" style="color:var(--protein)">\${recipe.macros.protein}g</div><div class="unit">Protein</div></div>
          <div class="macro-box"><div class="val" style="color:var(--carb)">\${recipe.macros.carbs}g</div><div class="unit">Carbs</div></div>
          <div class="macro-box"><div class="val" style="color:#f59e0b">\${recipe.macros.fat}g</div><div class="unit">Fat</div></div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-label">All Ingredients</div>
        <div class="modal-value">\${recipe.ingredients.join(', ')}</div>
      </div>
      <div class="modal-section">
        <div class="modal-label">Tags</div>
        <div class="tag-list">\${recipe.tags.map(t => '<span class="modal-tag">' + t + '</span>').join('')}</div>
      </div>
      <div class="modal-section" style="display:flex;gap:12px">
        <div style="flex:1"><div class="modal-label">Cuisine</div><div class="modal-value">\${recipe.cuisine}</div></div>
        <div style="flex:1"><div class="modal-label">Prep Time</div><div class="modal-value">\${recipe.prepTime} min</div></div>
        <div style="flex:1"><div class="modal-label">Spice</div><div class="modal-value">\${recipe.spiceLevel}</div></div>
      </div>
      <button class="btn-close" onclick="closeModal()">✕ Close</button>
    \`;
    document.getElementById('modal').classList.add('open');
  }
  function closeModal() { document.getElementById('modal').classList.remove('open'); }

  // ── Shopping list ────────────────────────────────────────────────────────
  const CATEGORIES = {
    'Dairy & Paneer':     /paneer|yogurt|curd|cream|butter|mozzarella|ricotta|parmesan|milk|ghee|cheese/,
    'Grains & Bread':     /\\brice\\b|roti|naan|bread|pasta|noodles|oats|flour|paratha|thepla|toast|spaghetti|penne|rigatoni|ditalini|arborio/,
    'Legumes & Tofu':     /\\bdal\\b|lentil|bean|chickpea|tofu|sprout|rajma|chana|moong|toor|masoor|cannellini/,
    'Produce':            /onion|tomato|spinach|potato|capsicum|cauliflower|eggplant|zucchini|carrot|broccoli|\\bpea\\b|mushroom|ginger|garlic|chilli|coriander|fenugreek|bok choy|cabbage|spring onion|celery|asparagus|cherry|methi|basil|thyme|parsley|rosemary|curry leaves/,
    'Nuts & Seeds':       /almond|peanut|cashew|chia|sesame|walnut|\\bseed\\b|\\bnut\\b/,
    'Fruits':             /banana|berry|lemon|pomegranate|\\bfruit\\b/,
    'Condiments & Sauces':/soy sauce|sesame oil|rice vinegar|tamarind|miso|chilli sauce|red wine|white wine|olive oil|doubanjiang|\\boil\\b/,
  };
  function categorizeIngredient(ing) {
    const lower = ing.toLowerCase();
    for (const [cat, re] of Object.entries(CATEGORIES)) {
      if (re.test(lower)) return cat;
    }
    return 'Pantry & Spices';
  }
  function buildShoppingList() {
    const counts = {};
    for (const day of Object.values(planData.days)) {
      for (const t of ['breakfast','lunch','dinner']) {
        const meal = day[t]; if (!meal) continue;
        for (const ing of meal.ingredients) {
          const key = ing.toLowerCase().trim();
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    }
    const cats = {};
    for (const [ing, count] of Object.entries(counts)) {
      const cat = categorizeIngredient(ing);
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push({ name: ing, count });
    }
    return cats;
  }
  function renderShoppingList() {
    const cats = buildShoppingList();
    const grid = document.getElementById('shopping-grid');
    grid.innerHTML = Object.entries(cats).map(([cat, items]) => \`
      <div class="shop-category">
        <div class="shop-cat-title">\${cat}</div>
        \${items.sort((a,b)=>a.name.localeCompare(b.name)).map(item => \`
          <div class="shop-item">
            <input type="checkbox" id="si-\${item.name.replace(/\\s+/g,'-')}">
            <label for="si-\${item.name.replace(/\\s+/g,'-')}">\${item.name}</label>
            \${item.count > 1 ? '<span class="shop-count">×' + item.count + '</span>' : ''}
          </div>\`).join('')}
      </div>
    \`).join('');
  }
  function copyShoppingList() {
    const cats = buildShoppingList();
    let text = '🛒 Shopping List\\n\\n';
    for (const [cat, items] of Object.entries(cats)) {
      text += cat + ':\\n';
      items.sort((a,b)=>a.name.localeCompare(b.name)).forEach(i => { text += '  • ' + i.name + (i.count > 1 ? ' (×' + i.count + ')' : '') + '\\n'; });
      text += '\\n';
    }
    navigator.clipboard.writeText(text).then(() => showToast('📋 Copied to clipboard!'));
  }

  // ── Settings ─────────────────────────────────────────────────────────────
  let currentSettings = {};
  function initSettingsUI() {
    const saved = JSON.parse(localStorage.getItem('mealplanner-settings') || 'null') || {
      workoutSchedule: planData.userProfile.workoutSchedule || {},
      weight: planData.userProfile.weight || 70,
      height: planData.userProfile.height || 168,
    };
    currentSettings = JSON.parse(JSON.stringify(saved));
    document.getElementById('input-weight').value = saved.weight || 70;
    document.getElementById('input-height').value = saved.height || 168;
    document.getElementById('input-weight').oninput = () => updateTargets();
    document.getElementById('input-height').oninput = () => updateTargets();
    renderScheduleGrid(saved.workoutSchedule);
    updateTargets();
  }
  function renderScheduleGrid(schedule) {
    const grid = document.getElementById('schedule-grid');
    grid.innerHTML = DAYS.map(day => \`
      <div class="schedule-row">
        <span class="schedule-day">\${day}</span>
        <div class="type-btns">
          \${['gym','running','rest'].map(type => \`
            <button class="type-btn \${schedule[day]===type ? 'active-' + type : ''}"
              onclick="setWorkoutDay('\${day}','\${type}',this)">\${type==='running'?'🏃':type==='gym'?'🏋️':'😴'} \${type}</button>
          \`).join('')}
        </div>
      </div>
    \`).join('');
  }
  function setWorkoutDay(day, type, btn) {
    currentSettings.workoutSchedule[day] = type;
    btn.closest('.type-btns').querySelectorAll('.type-btn').forEach(b => {
      b.className = 'type-btn';
    });
    btn.className = 'type-btn active-' + type;
    updateTargets();
  }
  function updateTargets() {
    const w = parseFloat(document.getElementById('input-weight').value) || 70;
    const list = document.getElementById('targets-list');
    const wdays = Object.values(currentSettings.workoutSchedule || {});
    const gymCount = wdays.filter(d=>d==='gym').length;
    const runCount = wdays.filter(d=>d==='running').length;
    list.innerHTML = \`
      <div class="target-row"><span>🏋️ Gym days (\${gymCount}×/wk)</span><span>\${Math.round(w*32)} kcal · \${Math.round(w*2.0)}g protein</span></div>
      <div class="target-row"><span>🏃 Run days (\${runCount}×/wk)</span><span>\${Math.round(w*29)} kcal · \${Math.round(w*1.7)}g protein</span></div>
      <div class="target-row"><span>😴 Rest days</span><span>\${Math.round(w*25)} kcal · \${Math.round(w*1.4)}g protein</span></div>
    \`;
  }
  function saveSettings() {
    const w = parseFloat(document.getElementById('input-weight').value) || 70;
    const h = parseFloat(document.getElementById('input-height').value) || 168;
    const settings = {
      weight: w, height: h,
      workoutSchedule: currentSettings.workoutSchedule,
      dailyCalorieTargets: { gym: Math.round(w*32), running: Math.round(w*29), rest: Math.round(w*25) },
      dailyProteinTargets: { gym: Math.round(w*2.0), running: Math.round(w*1.7), rest: Math.round(w*1.4) },
    };
    localStorage.setItem('mealplanner-settings', JSON.stringify(settings));
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'user_settings.json'; a.click();
    showToast('✅ Settings saved! Move user_settings.json → data/ then run node preview.mjs');
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (isError ? ' error' : '') + ' show';
    setTimeout(() => { t.className = 'toast' + (isError ? ' error' : ''); }, 3500);
  }

  // ── Animate bars on load ─────────────────────────────────────────────────
  document.querySelectorAll('.fill').forEach((el, i) => {
    const w = el.style.width; el.style.width = '0%';
    setTimeout(() => { el.style.width = w; }, 150 + i * 25);
  });

  // ── Chat ─────────────────────────────────────────────────────────────────
  const SESSION_ID = Math.random().toString(36).slice(2);
  const IS_SERVER  = window.location.protocol !== 'file:';
  let chatReady = false;
  let chatBusy  = false;

  function initChat() {
    if (chatReady) return;
    chatReady = true;
    const msgs = document.getElementById('chat-messages');
    if (!IS_SERVER) {
      msgs.innerHTML = '';
      document.getElementById('chat-wrap').innerHTML = \`
        <div class="chat-offline">
          💬 Chat requires the local server.<br><br>
          Stop this file and run:<br>
          <code>node server.mjs</code><br><br>
          Then open <code>http://localhost:3000</code>
        </div>\`;
      return;
    }
    appendChat('assistant', '👋 Hi! I have your full meal plan loaded. Ask me anything — nutrition, ingredients, or just say "shuffle Wednesday lunch" and I will do it for you.');
  }

  function appendChat(role, text, loading = false) {
    const msgs = document.getElementById('chat-messages');
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg ' + role + (loading ? ' loading' : '');
    if (loading) wrap.id = 'chat-loading';
    wrap.innerHTML = \`<div class="chat-bubble">\${text}</div>\`;
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    return wrap;
  }

  function usePrompt(text) {
    document.getElementById('chat-input').value = text;
    document.getElementById('chat-input').focus();
  }

  async function sendChat() {
    if (!IS_SERVER || chatBusy) return;
    const input = document.getElementById('chat-input');
    const text  = input.value.trim();
    if (!text) return;
    input.value = '';
    appendChat('user', text);
    chatBusy = true;
    document.getElementById('chat-send-btn').disabled = true;
    const loadingEl = appendChat('assistant', '⏳ Thinking…', true);
    try {
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: SESSION_ID }),
      });
      const data = await res.json();
      loadingEl.remove();
      if (data.error) {
        appendChat('assistant', '❌ ' + data.error);
      } else {
        appendChat('assistant', data.reply);
        if (data.planUpdated) {
          appendChat('assistant', '✅ Plan updated! Refreshing dashboard in 2s…');
          setTimeout(() => window.location.reload(), 2000);
        }
      }
    } catch {
      loadingEl?.remove();
      appendChat('assistant', '❌ Could not reach the server. Is <code>node server.mjs</code> running?');
    } finally {
      chatBusy = false;
      document.getElementById('chat-send-btn').disabled = false;
      document.getElementById('chat-messages').scrollTop = 999999;
    }
  }
</script>
</body>
</html>`;
}
// ─── Tool definition for MCP ──────────────────────────────────────────────
export const showUIToolDef = {
    name: 'show_meal_plan_ui',
    description: 'Generates and returns a rich interactive HTML dashboard of the current weekly meal plan. ' +
        'Uses the Prefab/MCP-UI resource pattern to push the UI to the host (Claude Desktop, Goose, or web app). ' +
        'Shows 7 days × 3 meals with macro tracking, workout badges, cuisine flags, shuffle/detail buttons, shopping list, and settings.',
    inputSchema: {
        type: 'object',
        properties: {
            theme: {
                type: 'string',
                enum: ['dark', 'light'],
                description: 'UI theme (default: dark).',
            },
        },
        required: [],
    },
};
//# sourceMappingURL=showUI.js.map