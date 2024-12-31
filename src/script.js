let uplot;

function setup() {
  document.getElementById('warn').style.display = "none";
  document.getElementById('download').style.display = "block";

  // set chart
  uplot = new uPlot(config, null, document.getElementById("chart"));

  // assign resize handler
  window.addEventListener("resize", e => {
    uplot.setSize({
      width: window.innerWidth * 0.96,
    });
  });

  // load dataset
  fetch('data.msgpack', {
    method: 'GET',
    cache: 'force-cache',
  })
    .then((response) => {
      if (!response.ok) {
        alert('Failed to fetch dataset');
      }

      const size = parseInt(response.headers.get('content-length'));
      const reader = response.body.getReader();
      let rcv = 0;

      return new ReadableStream({
        start(controller) {
          function push() {
            reader.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }
              rcv += value.byteLength;
              document.getElementById('percent').innerText = (rcv / size * 100).toFixed(0);
              controller.enqueue(value);
              push();
            });
          }
          push();
        }
      });
    })
    .then((stream) => new Response(stream))
    .then((response) => response.arrayBuffer())
    .then((data) => {
      document.getElementById('download').innerHTML = "데이터 파싱 중...";
      setTimeout(() => process(window.MessagePack.decode(new Uint8Array(data))), 50);
    });
}

function process(record) {
  for (let log of record) {
    if (log.source === 'CAN') {
      switch (log.key) {
        case 'CAN_BMS_CORE':
          delete log.parsed.failsafe;
          push('BMS', log, result);
          break;

        case 'CAN_BMS_TEMP':
          log.parsed.temp_max = log.parsed.temperature.max.value;
          log.parsed.temp_min = log.parsed.temperature.min.value;
          delete log.parsed.temperature;
          push('BMS', log, result);
          break;

        case "CAN_INV_TEMP_1":
          log.parsed.temp_igbt_a = log.parsed.igbt.a;
          log.parsed.temp_igbt_b = log.parsed.igbt.b;
          log.parsed.temp_igbt_c = log.parsed.igbt.c;
          log.parsed.temp_igbt_max = log.parsed.igbt.max.temperature;
          log.parsed.temp_gatedriveer = log.parsed.gatedriver;
          delete log.parsed.igbt;
          delete log.parsed.gatedriver;
          push('INV', log, result);
          break;

        case "CAN_INV_TEMP_2":
          log.parsed.temp_controlboard = log.parsed.controlboard;
          delete log.parsed.controlboard;
          delete log.parsed.RTD1;
          delete log.parsed.RTD2;
          delete log.parsed.RTD3;
          push('INV', log, result);
          break;

        case "CAN_INV_TEMP_3":
          log.parsed.temp_motor = log.parsed.motor;
          delete log.parsed.coolant;
          delete log.parsed.hotspot;
          delete log.parsed.motor;
          push('INV', log, result);
          break;

        case "CAN_INV_ANALOG_IN":
          log.parsed.analog_accel = log.parsed.AIN1;
          log.parsed.analog_brake = log.parsed.AIN3;
          delete log.parsed.AIN1;
          delete log.parsed.AIN2;
          delete log.parsed.AIN3;
          delete log.parsed.AIN4;
          delete log.parsed.AIN5;
          delete log.parsed.AIN6;
          push('INV', log, result);
          break;

        case "CAN_INV_DIGITAL_IN":
          log.parsed.digital_fwd_enable = log.parsed.DIN1;
          log.parsed.digital_rev_enable = log.parsed.DIN2;
          log.parsed.digital_brake_switch = log.parsed.DIN3;
          delete log.parsed.DIN1;
          delete log.parsed.DIN2;
          delete log.parsed.DIN3;
          delete log.parsed.DIN4;
          delete log.parsed.DIN5;
          delete log.parsed.DIN6;
          delete log.parsed.DIN7;
          delete log.parsed.DIN8;
          push('INV', log, result);
          break;

        case "CAN_INV_MOTOR_POS":
        case "CAN_INV_CURRENT":
        case "CAN_INV_VOLTAGE":
        case "CAN_INV_FLUX":
        case "CAN_INV_REF":
        case "CAN_INV_TORQUE":
        case "CAN_INV_FLUX_WEAKING":
          push('INV', log, result);
          break;

        case "CAN_INV_STATE":
          delete log.parsed.pwm_freq;
          delete log.parsed.limit_hot_spot;
          delete log.parsed.coolant_temperature_limiting;
          push('INV', log, result);
          break;

        case "CAN_INV_FAULT":
          log.parsed.fault_POST = log.parsed.POST;
          log.parsed.fault_RUN = log.parsed.RUN;
          delete log.parsed.POST;
          delete log.parsed.POST_FAULT_HI;
          delete log.parsed.POST_FAULT_LO;
          delete log.parsed.RUN;
          delete log.parsed.RUN_FAULT_HI;
          delete log.parsed.RUN_FAULT_LO;
          push('INV', log, result);
          break;
      }
    } else if (log.source === 'ACC') {
      if (log.key === 'ACC_DATA') {
        push('ACCEL', log, result);
      }
    }
  }

  current.push(result[0]);
  uplot.setData(current);

  document.getElementById('download').style.display = "none";
  document.getElementById('main').style.display = "block";
}

function push(type, log, result) {
  let valid = [];

  Object.keys(log.parsed).forEach((x, i) => {
    if (!param[`${type}_${x}`]) {
      result.push(Array(log_cnt).fill(null));
      param[`${type}_${x}`] = param_cnt++;
    }

    result[param[`${type}_${x}`]].push(log.parsed[x]);
    valid.push(param[`${type}_${x}`]);
  });

  result[param['timestamp']].push(Number(new Date(log.datetime)));
  result.forEach((x, i) => {
    if (i !== 0 && !valid.find(k => k === i)) {
      x.push(null);
    }
  });
  log_cnt++;
}

let result = [[]];
let current = [];
let names = [];

let param = { "timestamp": 0 };
let param_cnt = 1;
let log_cnt = 0;

const types = {
  "BMS_dcl":                             { scale: "A",       unit: "A",   name: "BMS_dcl" },
  "BMS_ccl":                             { scale: "A",       unit: "A",   name: "BMS_ccl" },
  "BMS_temp_max":                        { scale: "C",       unit: "°C",  name: "BMS_temp_max" },
  "BMS_temp_min":                        { scale: "C",       unit: "°C",  name: "BMS_temp_min" },
  "BMS_soc":                             { scale: "PERCENT", unit: "%",   name: "BMS_soc" },
  "BMS_capacity":                        { scale: "AH",      unit: "Ah",  name: "BMS_capacity" },
  "BMS_voltage":                         { scale: "HV",      unit: "V",   name: "BMS_voltage" },
  "BMS_current":                         { scale: "A",       unit: "A",   name: "BMS_current" },

  "ACCEL_x":                             { scale: "G",       unit: "g",   name: "ACCEL_x" },
  "ACCEL_y":                             { scale: "G",       unit: "g",   name: "ACCEL_y" },
  "ACCEL_z":                             { scale: "G",       unit: "g",   name: "ACCEL_z" },

  "INV_modulation_index":                { scale: "ETC",     unit: "",    name: "INV_modulation_index" },
  "INV_flux_weakening_output":           { scale: "A",       unit: "A",   name: "INV_flux_weakening_output" },
  "INV_Id_command":                      { scale: "A",       unit: "A",   name: "INV_Id_command" },
  "INV_Iq_command":                      { scale: "A",       unit: "A",   name: "INV_Iq_command" },
  "INV_commanded_torque":                { scale: "Nm",      unit: "Nm",  name: "INV_commanded_torque" },
  "INV_torque_feedback":                 { scale: "Nm",      unit: "Nm",  name: "INV_torque_feedback" },
  "INV_power_on_timer":                  { scale: "ETC",     unit: "",    name: "INV_power_on_timer" },
  "INV_fault_POST":                      { scale: "ETC",     unit: "",    name: "INV_fault_POST" },
  "INV_fault_RUN":                       { scale: "ETC",     unit: "",    name: "INV_fault_RUN" },
  "INV_vsm_state":                       { scale: "ETC",     unit: "",    name: "INV_vsm_state" },
  "INV_inverter_state":                  { scale: "ETC",     unit: "",    name: "INV_inverter_state" },
  "INV_relay_state":                     { scale: "ETC",     unit: "",    name: "INV_relay_state" },
  "INV_inverter_run_mode":               { scale: "ETC",     unit: "",    name: "INV_inverter_run_mode" },
  "INV_inverter_active_discharge_state": { scale: "ETC",     unit: "",    name: "INV_inverter_active_discharge_state" },
  "INV_inverter_command_mode":           { scale: "ETC",     unit: "",    name: "INV_inverter_command_mode" },
  "INV_inverter_enable_state":           { scale: "ETC",     unit: "",    name: "INV_inverter_enable_state" },
  "INV_inverter_start_mode_active":      { scale: "ETC",     unit: "",    name: "INV_inverter_start_mode_active" },
  "INV_inverter_enable_lockout":         { scale: "ETC",     unit: "",    name: "INV_inverter_enable_lockout" },
  "INV_direction_command":               { scale: "ETC",     unit: "",    name: "INV_direction_command" },
  "INV_bms_active":                      { scale: "ETC",     unit: "",    name: "INV_bms_active" },
  "INV_bms_limiting_torque":             { scale: "ETC",     unit: "",    name: "INV_bms_limiting_torque" },
  "INV_limit_max_speed":                 { scale: "ETC",     unit: "",    name: "INV_limit_max_speed" },
  "INV_low_speed_limiting":              { scale: "ETC",     unit: "",    name: "INV_low_speed_limiting" },
  "INV_flux_command":                    { scale: "FLUX",    unit: "Wb",  name: "INV_flux_command" },
  "INV_flux_feedback":                   { scale: "FLUX",    unit: "Wb",  name: "INV_flux_feedback" },
  "INV_Id_feedback":                     { scale: "A",       unit: "A",   name: "INV_Id_feedback" },
  "INV_Iq_feedback":                     { scale: "A",       unit: "A",   name: "INV_Iq_feedback" },
  "INV_dc_bus_voltage":                  { scale: "HV",      unit: "V",   name: "INV_dc_bus_voltage" },
  "INV_output_voltage":                  { scale: "HV",      unit: "V",   name: "INV_output_voltage" },
  "INV_VAB_Vd_voltage":                  { scale: "HV",      unit: "V",   name: "INV_VAB_Vd_voltage" },
  "INV_VBC_Vq_voltage":                  { scale: "HV",      unit: "V",   name: "INV_VBC_Vq_voltage" },
  "INV_phaseA":                          { scale: "A",       unit: "A",   name: "INV_phaseA" },
  "INV_phaseB":                          { scale: "A",       unit: "A",   name: "INV_phaseB" },
  "INV_phaseC":                          { scale: "A",       unit: "A",   name: "INV_phaseC" },
  "INV_dc_bus_current":                  { scale: "A",       unit: "A",   name: "INV_dc_bus_current" },
  "INV_motor_angle":                     { scale: "DEG",     unit: "°",   name: "INV_motor_angle" },
  "INV_motor_speed":                     { scale: "RPM",     unit: "rpm", name: "INV_motor_speed" },
  "INV_electrical_output_freq":          { scale: "FREQ",    unit: "Hz",  name: "INV_electrical_output_freq" },
  "INV_delta_resolver_filtered":         { scale: "DEG",     unit: "°",   name: "INV_delta_resolver_filtered" },
  "INV_digital_fwd_enable":              { scale: "ETC",     unit: "",    name: "INV_digital_fwd_enable" },
  "INV_digital_rev_enable":              { scale: "ETC",     unit: "",    name: "INV_digital_rev_enable" },
  "INV_digital_brake_switch":            { scale: "ETC",     unit: "",    name: "INV_digital_brake_switch" },
  "INV_analog_accel":                    { scale: "LV",      unit: "V",   name: "INV_analog_accel" },
  "INV_analog_brake":                    { scale: "LV",      unit: "V",   name: "INV_analog_brake" },
  "INV_ref_1v5":                         { scale: "LV",      unit: "V",   name: "INV_ref_1v5" },
  "INV_ref_2v5":                         { scale: "LV",      unit: "V",   name: "INV_ref_2v5" },
  "INV_ref_5v":                          { scale: "LV",      unit: "V",   name: "INV_ref_5v" },
  "INV_ref_12v":                         { scale: "LV",      unit: "V",   name: "INV_ref_12v" },
  "INV_torque_shudder":                  { scale: "Nm",      unit: "Nm",  name: "INV_torque_shudder" },
  "INV_temp_motor":                      { scale: "C",       unit: "°C",  name: "INV_temp_motor" },
  "INV_temp_controlboard":               { scale: "C",       unit: "°C",  name: "INV_temp_controlboard" },
  "INV_temp_igbt_a":                     { scale: "C",       unit: "°C",  name: "INV_temp_igbt_a" },
  "INV_temp_igbt_b":                     { scale: "C",       unit: "°C",  name: "INV_temp_igbt_b" },
  "INV_temp_igbt_c":                     { scale: "C",       unit: "°C",  name: "INV_temp_igbt_c" },
  "INV_temp_igbt_max":                   { scale: "C",       unit: "°C",  name: "INV_temp_igbt_max" },
  "INV_temp_gatedriver":                 { scale: "C",       unit: "°C",  name: "INV_temp_gatedriver" }
};

let html = "<option disabled selected>데이터 선택</option>";
Object.keys(types).forEach(x => {
  html += `<option value='${x}'>${x}</option>`;
});
document.getElementById('select-data').innerHTML = html;

function generateColors(numColors) {
  const colors = [];
  const hueStep = 360 / numColors;

  const seed = 12345;
  const seededRandom = (function (seed) {
    let currentSeed = seed;
    return function () {
      return ((currentSeed * 9301 + 49297) % 233280) / 233280;
    };
  })(seed);

  const randomizedIndexes = Array.from({ length: numColors }, (_, i) => i).sort(() => seededRandom() - 0.5);

  for (let i = 0; i < numColors; i++) {
    colors.push(`hsl(${Math.round((randomizedIndexes[i] * hueStep) % 360)}, 70%, 50%)`);
  }

  return colors;
}

let color_idx = 0;
let colors = generateColors(Object.keys(types).length);

const scales = Object.values(types).filter((item, index, self) =>
  index === self.findIndex((t) => t.scale === item.scale && t.unit === item.unit)
).map((item, index) => ({
  scale: item.scale,
  unit: item.unit
}));

const axes = [
  { values: (self, ticks) => ticks.map(rawValue => new Date(rawValue).format("HH:MM:ss\nl")) },
  ...scales.map((x, i) => ({
    scale: x.scale,
    values: (self, ticks) => ticks.map(rawValue => rawValue.toFixed(rawValue >= 100 ? 0 : 1) + x.unit),
    grid: { show: false, },
    ticks: { show: false, },
    side: i % 2 ? 1 : 3,
  }))
];

const series = [
  { value: (self, rawValue) => (rawValue ? new Date(rawValue).format("HH:MM:ss.l") : '-') },
  ...Object.values(types).map(x => ({
    label: x.name,
    scale: x.scale,
    stroke: colors[color_idx++],
    spanGaps: true,
    value: (self, rawValue) => (rawValue ? rawValue.toFixed(rawValue >= 100 ? 0 : 1) : (rawValue === 0 ? 0 : '-')) + x.unit,
  }))
];

const config = {
  width: window.innerWidth - 100,
  height: window.innerHeight - 200,
  ms: true,
  series: [series[0]],
  axes: axes,
  plugins: [
    touchZoomPlugin(),
    wheelZoomPlugin({ factor: 0.75 })
  ],
};

let data_cnt = 0;

function add() {
  let value = document.getElementById('select-data').value.trim();

  if (value && value !== '데이터 선택' && !names.find(x => x === value)) {
    data_cnt++;
    uplot.addSeries(series[param[value]], data_cnt);
    current.push(result[param[value]]);
    names.push(value);
    uplot.setData(current);
  }
}


/* new Date().format() ********************************************************/
var dateFormat = function () {
  var token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
    timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|    UTC)(?:[-+]\d{4})?)\b/g,
    timezoneClip = /[^-+\dA-Z]/g,
    pad = function (val, len) {
      val = String(val);
      len = len || 2;
      while (val.length < len) val = '0' + val;
      return val;
    };
  return function (date, mask, utc) {
    var dF = dateFormat;
    if (arguments.length == 1 && Object.prototype.toString.call(date) == '[object String]' && !/\d/.test(date)) {
      mask = date;
      date = undefined;
    }
    date = date ? new Date(date) : new Date;
    if (isNaN(date)) throw SyntaxError('invalid date');
    mask = String(dF.masks[mask] || mask || dF.masks['default']);
    if (mask.slice(0, 4) == 'UTC:') {
      mask = mask.slice(4);
      utc = true;
    }
    var _ = utc ? 'getUTC' : 'get',
      d = date[_ + 'Date'](),
      D = date[_ + 'Day'](),
      m = date[_ + 'Month'](),
      y = date[_ + 'FullYear'](),
      H = date[_ + 'Hours'](),
      M = date[_ + 'Minutes'](),
      s = date[_ + 'Seconds'](),
      L = date[_ + 'Milliseconds'](),
      o = utc ? 0 : date.getTimezoneOffset(),
      flags = {
        d: d,
        dd: pad(d),
        ddd: dF.i18n.dayNames[D],
        dddd: dF.i18n.dayNames[D + 7],
        m: m + 1,
        mm: pad(m + 1),
        mmm: dF.i18n.monthNames[m],
        mmmm: dF.i18n.monthNames[m + 12],
        yy: String(y).slice(2),
        yyyy: y,
        h: H % 12 || 12,
        hh: pad(H % 12 || 12),
        H: H,
        HH: pad(H),
        M: M,
        MM: pad(M),
        s: s,
        ss: pad(s),
        l: pad(L, 3),
        L: pad(L > 99 ? Math.round(L / 10) : L),
        t: H < 12 ? 'a' : 'p',
        tt: H < 12 ? 'am' : 'pm',
        T: H < 12 ? 'A' : 'P',
        TT: H < 12 ? '오전' : '오후',
        Z: utc ? 'UTC' : (String(date).match(timezone) || ['']).pop().replace(timezoneClip, ''),
        o: (o > 0 ? '-' : '+') + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
        S: ['th', 'st', 'nd', 'rd'][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
      };
    return mask.replace(token, function ($0) {
      return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
    });
  };
}();
dateFormat.masks = { 'default': 'ddd mmm dd yyyy HH:MM:ss' };
dateFormat.i18n = {
  dayNames: [
    '일', '월', '화', '수', '목', '금', '토',
    '일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'
  ],
  monthNames: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
  ]
};
Date.prototype.format = function (mask, utc) { return dateFormat(this, mask, utc); };
