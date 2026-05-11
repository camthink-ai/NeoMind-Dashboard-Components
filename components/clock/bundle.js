var ClockWidget = (function() {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  function Clock(props) {
    var state = React.useState(new Date());
    var time = state[0];
    var setTime = state[1];

    React.useEffect(function() {
      var timer = setInterval(function() { setTime(new Date()); }, 1000);
      return function() { clearInterval(timer); };
    }, []);

    var config = props.config || {};
    var format = config.format || '24h';
    var showSeconds = config.showSeconds !== false;

    var hours = time.getHours();
    var minutes = time.getMinutes();
    var seconds = time.getSeconds();
    var is12 = format === '12h';
    var ampm = '';
    if (is12) {
      ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
    }

    var h = String(hours).padStart(2, '0');
    var m = String(minutes).padStart(2, '0');
    var s = String(seconds).padStart(2, '0');

    var weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var day = weekdays[time.getDay()];
    var dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return jsx('div', {
      className: 'flex flex-col items-center justify-center h-full w-full p-3 select-none',
      children: jsxs('div', {
        className: 'flex flex-col items-center gap-1',
        children: [
          jsxs('div', {
            key: 'time',
            className: 'flex items-baseline gap-0.5',
            children: [
              jsx('span', { className: 'text-3xl font-mono font-bold tracking-tight text-foreground tabular-nums', children: h + ':' + m }),
              showSeconds ? jsx('span', { className: 'text-lg font-mono text-muted-foreground tabular-nums', children: ':' + s }) : null,
              is12 ? jsx('span', { className: 'text-xs font-medium text-muted-foreground ml-1', children: ampm }) : null
            ]
          }),
          jsxs('div', {
            key: 'date',
            className: 'flex items-center gap-1.5 text-xs text-muted-foreground',
            children: [
              jsx('span', { children: day }),
              jsx('span', { children: '·' }),
              jsx('span', { children: dateStr })
            ]
          })
        ]
      })
    });
  }

  return { default: Clock, Clock: Clock };
})();
