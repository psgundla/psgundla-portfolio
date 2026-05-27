/* Page logic — drives camera progress from scroll, manages chapter tag,
 * compass HUD, side rail, and section observers. */
(function () {
  const sections = Array.from(document.querySelectorAll('section.chapter'));
  const total = sections.length;
  const tag = document.getElementById('chapterTag');
  const compass = document.getElementById('compass');
  const compassPct = document.getElementById('compass-pct');
  const compassBar = compass ? compass.querySelector('.bar') : null;
  const compassStops = compass ? Array.from(compass.querySelectorAll('.stops span')) : [];
  const rail = document.getElementById('rail');

  // Build rail buttons
  if (rail) {
    sections.forEach((s, i) => {
      const b = document.createElement('button');
      b.title = s.getAttribute('data-label') || `Chapter ${i+1}`;
      b.dataset.idx = i;
      b.addEventListener('click', () => {
        s.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      rail.appendChild(b);
    });
  }
  const railBtns = rail ? Array.from(rail.children) : [];

  // Map sections -> stops in scene (matches STOPS in scene.js)
  // sections[0..9] correspond to stops 0..9 in scene.js
  function update() {
    const scrollY = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const overall = docH > 0 ? scrollY / docH : 0;

    // Each section transitions camera to that stop. Use overall scroll as the global progress.
    if (window.__scene) window.__scene.setProgress(overall);

    // Determine active section
    let active = 0;
    for (let i = 0; i < sections.length; i++) {
      const r = sections[i].getBoundingClientRect();
      if (r.top <= window.innerHeight * 0.5) active = i;
    }

    // Update chapter tag
    if (tag) {
      const num = String(active + 1).padStart(2, '0');
      const tot = String(total).padStart(2, '0');
      const where = sections[active].getAttribute('data-where') || '';
      tag.children[0].textContent = `CH ${num} / ${tot}`;
      tag.children[1].textContent = where;
    }

    // Compass
    if (compassPct) compassPct.textContent = Math.round(overall * 100) + '%';
    if (compassBar) compassBar.style.setProperty('--prog', (overall * 100) + '%');
    // Highlight closest stop (origin/hyderabad/manipal/grenoble/essen) ~ sections 0,2,3,4,5
    const stopMap = [0, 2, 3, 4, 5];
    let closestStop = 0, bestD = Infinity;
    stopMap.forEach((sIdx, k) => {
      const d = Math.abs(active - sIdx);
      if (d < bestD) { bestD = d; closestStop = k; }
    });
    compassStops.forEach((el, i) => el.classList.toggle('on', i === closestStop));

    // Rail dots
    railBtns.forEach((b, i) => b.classList.toggle('active', i === active));

    // Top nav active link
    document.querySelectorAll('.nav a[data-link]').forEach(a => {
      const map = { about:1, origins:2, research:6, stack:7, contact:9 };
      const target = map[a.getAttribute('data-link')];
      a.classList.toggle('active', target === active);
    });

    // Skill timeline node activation by section progress within section 7
    const skillsSection = document.getElementById('stack');
    if (skillsSection) {
      const r = skillsSection.getBoundingClientRect();
      const inView = r.top < window.innerHeight && r.bottom > 0;
      if (inView) {
        const denom = (skillsSection.offsetHeight - window.innerHeight) || skillsSection.offsetHeight;
        const p = Math.max(0, Math.min(1, -r.top / denom));
        const nodes = Array.from(skillsSection.querySelectorAll('.skill-node'));
        const upto = Math.floor(p * nodes.length);
        nodes.forEach((n, i) => n.classList.toggle('active', i <= upto));
        const track = skillsSection.querySelector('.skills-track');
        if (track) track.style.setProperty('--prog', p);
      }
    }
  }

  let raf;
  window.addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(() => { update(); raf = null; });
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
