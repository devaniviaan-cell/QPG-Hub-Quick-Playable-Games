(function(){
  var search = document.getElementById('search');
  var pills = Array.prototype.slice.call(document.querySelectorAll('.pill'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var resultsCount = document.getElementById('results-count');
  var emptyState = document.getElementById('empty-state');
  var emptyQuery = document.getElementById('empty-query');
  var activeCat = 'all';

  // keep the "N bite-size games" copy in sync with the actual number of cards
  var totalGames = cards.length;
  var gameCountEl = document.getElementById('game-count');
  if (gameCountEl) gameCountEl.textContent = totalGames;

  var descriptionMeta = document.getElementById('page-description');
  if (descriptionMeta){
    descriptionMeta.setAttribute(
      'content',
      totalGames + ' bite-size browser games. No installs, no accounts — pick one and press start.'
    );
  }

  // populate category counts once on load
  pills.forEach(function(pill){
    var cat = pill.dataset.cat;
    var n = cat === 'all' ? cards.length : cards.filter(function(c){ return c.dataset.cat === cat; }).length;
    pill.querySelector('.count').textContent = ' (' + n + ')';
  });

  function applyFilter(){
    var q = search.value.trim().toLowerCase();
    var visible = 0;

    cards.forEach(function(card){
      var matchesCat = activeCat === 'all' || card.dataset.cat === activeCat;
      var matchesQuery = !q || card.dataset.search.indexOf(q) !== -1;
      var show = matchesCat && matchesQuery;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    resultsCount.textContent = visible + (visible === 1 ? ' game' : ' games');

    if (visible === 0){
      emptyState.hidden = false;
      emptyQuery.textContent = q || (activeCat !== 'all' ? activeCat : '');
    } else {
      emptyState.hidden = true;
    }
  }

  pills.forEach(function(pill){
    pill.addEventListener('click', function(){
      pills.forEach(function(p){ p.classList.remove('active'); });
      pill.classList.add('active');
      activeCat = pill.dataset.cat;
      applyFilter();
    });
  });

  search.addEventListener('input', applyFilter);

  applyFilter();
})();
