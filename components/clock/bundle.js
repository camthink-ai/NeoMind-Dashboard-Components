var ClockWidget = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  // Inject keyframes once
  if (!document.getElementById('clock-widget-styles')) {
    var styleEl = document.createElement('style');
    styleEl.id = 'clock-widget-styles';
    styleEl.textContent = [
      '@keyframes clock-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }',
      '@keyframes clock-bar { from{width:0} to{width:var(--day-pct)} }',
      '@keyframes clock-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }'
    ].join('\n');
    document.head.appendChild(styleEl);
  }

  function getGreeting(h) {
    if (h >= 5 && h < 12) return 'Good Morning';
    if (h >= 12 && h < 18) return 'Good Afternoon';
    if (h >= 18 && h < 22) return 'Good Evening';
    return 'Good Night';
  }

  function getGreetingIcon(h) {
    if (h >= 6 && h < 18) return '\u2600'; // ☀
    if (h >= 18 && h < 21) return '\u263D'; // ☽
    return '\u263E'; // ☾
  }

  function getWeekNumber(d) {
    var target = new Date(d.valueOf());
    var dayNum = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNum + 3);
    var firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function Clock(props) {
    var state = React.useState(new Date());
    var time = state[0];
    var setTime = state[1];

    React.useEffect(function () {
      var timer = setInterval(function () { setTime(new Date()); }, 1000);
      return function () { clearInterval(timer); };
    }, []);

    var config = props.config || {};
    var format = config.format || '24h';
    var showSeconds = config.showSeconds !== false;

    var hours = time.getHours();
    var minutes = time.getMinutes();
    var seconds = time.getSeconds();
    var is12 = format === '12h';
    var ampm = '';
    var displayHours = hours;
    if (is12) {
      ampm = hours >= 12 ? 'PM' : 'AM';
      displayHours = hours % 12 || 12;
    }

    var h = pad2(displayHours);
    var m = pad2(minutes);
    var s = pad2(seconds);

    // Date info
    var weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var weekday = weekdays[time.getDay()];
    var month = months[time.getMonth()];
    var date = time.getDate();
    var year = time.getFullYear();
    var weekNum = getWeekNumber(time);

    // Day progress
    var dayProgress = ((hours * 3600 + minutes * 60 + seconds) / 86400 * 100).toFixed(1);

    // Timezone
    var tzOffset = -time.getTimezoneOffset();
    var tzSign = tzOffset >= 0 ? '+' : '-';
    var tzHours = Math.floor(Math.abs(tzOffset) / 60);
    var tzMins = Math.abs(tzOffset) % 60;
    var tzStr = 'UTC' + tzSign + tzHours + (tzMins ? ':' + pad2(tzMins) : '');

    var greeting = getGreeting(hours);
    var greetingIcon = getGreetingIcon(hours);

    // Style constants
    var cardBg = {
      background: 'linear-gradient(145deg, #0f1117 0%, #161923 50%, #0f1117 100%)',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.06)'
    };

    var greetingStyle = {
      color: 'rgba(255,255,255,0.45)',
      fontSize: '11px',
      fontWeight: '500',
      letterSpacing: '0.5px',
      textTransform: 'uppercase'
    };

    var timeStyle = {
      color: '#fff',
      fontSize: '42px',
      fontWeight: '200',
      letterSpacing: '-1px',
      lineHeight: '1',
      fontVariantNumeric: 'tabular-nums'
    };

    var colonStyle = {
      animation: 'clock-blink 2s ease-in-out infinite',
      color: 'rgba(255,255,255,0.6)'
    };

    var secondsStyle = {
      color: 'rgba(255,255,255,0.4)',
      fontSize: '18px',
      fontWeight: '300',
      fontVariantNumeric: 'tabular-nums',
      marginLeft: '4px',
      verticalAlign: 'super',
      lineHeight: '1'
    };

    var ampmStyle = {
      color: 'rgba(255,255,255,0.35)',
      fontSize: '12px',
      fontWeight: '600',
      marginLeft: '6px',
      letterSpacing: '1px'
    };

    var dividerStyle = {
      width: '32px',
      height: '1px',
      background: 'linear-gradient(90deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))',
      margin: '10px 0 8px 0'
    };

    var weekdayStyle = {
      color: 'rgba(255,255,255,0.75)',
      fontSize: '12px',
      fontWeight: '500',
      letterSpacing: '0.3px'
    };

    var dateStyle = {
      color: 'rgba(255,255,255,0.35)',
      fontSize: '12px',
      fontWeight: '400'
    };

    var metaStyle = {
      color: 'rgba(255,255,255,0.22)',
      fontSize: '10px',
      fontWeight: '400',
      letterSpacing: '0.3px'
    };

    var barTrackStyle = {
      position: 'absolute',
      bottom: '0',
      left: '0',
      right: '0',
      height: '2px',
      background: 'rgba(255,255,255,0.04)',
      borderRadius: '0 0 10px 10px',
      overflow: 'hidden'
    };

    var barFillStyle = {
      height: '100%',
      width: dayProgress + '%',
      background: 'linear-gradient(90deg, rgba(99,130,255,0.6), rgba(160,120,255,0.4))',
      borderRadius: '0 0 10px 10px',
      transition: 'width 1s linear'
    };

    return jsxs('div', {
      className: 'flex flex-col h-full w-full select-none',
      style: Object.assign({}, cardBg, { padding: '16px 18px 14px 18px', position: 'relative', overflow: 'hidden' }),
      children: [
        // Greeting line
        jsxs('div', {
          key: 'greeting',
          style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' },
          children: [
            jsx('span', { style: { fontSize: '13px' }, children: greetingIcon }),
            jsx('span', { style: greetingStyle, children: greeting })
          ]
        }),

        // Time display
        jsxs('div', {
          key: 'time',
          style: { display: 'flex', alignItems: 'baseline', lineHeight: '1' },
          children: [
            jsx('span', { style: timeStyle, children: h }),
            jsx('span', { style: Object.assign({}, timeStyle, colonStyle), children: ':' }),
            jsx('span', { style: timeStyle, children: m }),
            showSeconds ? jsx('span', { style: secondsStyle, children: s }) : null,
            is12 ? jsx('span', { style: ampmStyle, children: ampm }) : null
          ]
        }),

        // Divider
        jsx('div', { key: 'divider', style: dividerStyle }),

        // Date info
        jsxs('div', {
          key: 'date',
          style: { display: 'flex', alignItems: 'center', gap: '8px' },
          children: [
            jsx('span', { style: weekdayStyle, children: weekday }),
            jsx('span', { style: { color: 'rgba(255,255,255,0.15)' }, children: '\u00B7' }),
            jsxs('span', { style: dateStyle, children: [month, ' ', date, ', ', year] })
          ]
        }),

        // Meta line: week + timezone
        jsxs('div', {
          key: 'meta',
          style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' },
          children: [
            jsxs('span', { style: metaStyle, children: ['W', weekNum] }),
            jsx('span', { style: { color: 'rgba(255,255,255,0.1)' }, children: '\u00B7' }),
            jsx('span', { style: metaStyle, children: tzStr })
          ]
        }),

        // Day progress bar
        jsx('div', {
          key: 'bar',
          style: barTrackStyle,
          children: jsx('div', { style: barFillStyle })
        })
      ]
    });
  }

  return { default: Clock, Clock: Clock };
})();
