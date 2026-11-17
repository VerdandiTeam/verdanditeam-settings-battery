.pragma library

var MAX_VOLTS_AS_VOLTS = 100
var MAX_VOLTS_AS_MILLIVOLTS = 100000
var MIN_PLAUSIBLE_INPUT_VOLTS = 2
var MAX_PLAUSIBLE_INPUT_VOLTS = 25
var MAX_CURRENT_AS_MILLIAMPS = 2000
var MAX_CHARGE_AS_MILLIAMP_HOURS = 30000
var MAX_ENERGY_AS_MILLIWATT_HOURS = 500000
var MAX_POWER_AS_MILLIWATTS = 100000
var MIN_TEMPERATURE_AS_MILLIDEGREES = 1000
var MIN_PLAUSIBLE_CELSIUS = -40
var MAX_PLAUSIBLE_CELSIUS = 120
var MIN_PLAUSIBLE_HEALTH_RATIO = 0.3
var MAX_PLAUSIBLE_HEALTH_RATIO = 1.3
var MAX_HEALTH_PERCENT = 110
var MIN_ESTIMABLE_MILLIAMPS = 5
var MIN_ESTIMABLE_WATTS = 0.05
var MAX_REMAINING_CHARGE_LEVEL_MISMATCH = 15

function parseUevent(text) {
    var props = {}
    String(text || "").split("\n").forEach(function (line) {
        var eq = line.indexOf("=")
        if (eq <= 0)
            return
        var key = line.substring(0, eq).replace(/^POWER_SUPPLY_/, "")
        if (!props.hasOwnProperty(key))
            props[key] = line.substring(eq + 1).trim()
    })
    return props
}

function num(value) {
    if (value === undefined || value === null || value === "")
        return NaN
    var n = parseFloat(value)
    return isFinite(n) ? n : NaN
}

function has(value) {
    return !isNaN(value)
}

function selectedOption(value) {
    var bracketed = /\[([^\]]+)\]/.exec(value || "")
    return bracketed ? bracketed[1] : String(value || "").trim()
}

function voltageV(raw) {
    var v = num(raw)
    if (!(v > 0))
        return NaN
    if (v < MAX_VOLTS_AS_VOLTS)
        return v
    if (v < MAX_VOLTS_AS_MILLIVOLTS)
        return v / 1000
    return v / 1000000
}

function isMillivoltReading(raw) {
    var v = num(raw)
    return v >= MAX_VOLTS_AS_VOLTS && v < MAX_VOLTS_AS_MILLIVOLTS
}

function inputVoltageV(raw) {
    var v = num(raw) / 1000000
    return (v >= MIN_PLAUSIBLE_INPUT_VOLTS && v <= MAX_PLAUSIBLE_INPUT_VOLTS) ? v : NaN
}

function currentMa(raw, reportedInMilliunits) {
    var c = Math.abs(num(raw))
    if (!has(c) || c === 0)
        return c
    return (reportedInMilliunits || c < MAX_CURRENT_AS_MILLIAMPS) ? c : c / 1000
}

function positiveCurrentMa(raw) {
    return num(raw) > 0 ? currentMa(raw, false) : NaN
}

function chargeMah(raw) {
    var c = num(raw)
    if (!(c > 0))
        return NaN
    return c < MAX_CHARGE_AS_MILLIAMP_HOURS ? c : c / 1000
}

function energyWh(raw) {
    var e = num(raw)
    if (!(e > 0))
        return NaN
    return e < MAX_ENERGY_AS_MILLIWATT_HOURS ? e / 1000 : e / 1000000
}

function powerW(raw) {
    var p = Math.abs(num(raw))
    if (!(p > 0))
        return NaN
    return p < MAX_POWER_AS_MILLIWATTS ? p / 1000 : p / 1000000
}

function temperatureC(raw) {
    var t = num(raw)
    if (!has(t) || t === 0)
        return NaN
    var celsius = Math.abs(t) >= MIN_TEMPERATURE_AS_MILLIDEGREES ? t / 1000 : t / 10
    return (celsius < MIN_PLAUSIBLE_CELSIUS || celsius > MAX_PLAUSIBLE_CELSIUS) ? NaN : celsius
}

function plausibleHealthRatio(ratio) {
    return ratio >= MIN_PLAUSIBLE_HEALTH_RATIO && ratio <= MAX_PLAUSIBLE_HEALTH_RATIO
}

var BATTERY_NAME = /bat|bms|fuel|gauge|(^|[_-])fg($|[_-])/i
var BATTERY_TYPES = ["Battery", "BMS"]
var PRIMARY_BATTERY_NAME = /^(battery|BAT\d*|main[-_]battery)$/i

function isPeripheral(supply) {
    return supply.props.SCOPE === "Device"
}

function hasBatteryReadings(props) {
    return ["CAPACITY", "CHARGE_FULL", "CHARGE_FULL_DESIGN", "ENERGY_FULL"].some(function (key) {
        return props.hasOwnProperty(key)
    })
}

function isBatteryLike(supply) {
    var p = supply.props
    if (isPeripheral(supply) || p.PRESENT === "0")
        return false
    if (BATTERY_TYPES.indexOf(p.TYPE) >= 0)
        return true
    return BATTERY_NAME.test(supply.name) && hasBatteryReadings(p)
}

function primaryScore(supply) {
    var p = supply.props
    return (p.TYPE === "Battery" ? 8 : 0)
         + (PRIMARY_BATTERY_NAME.test(supply.name) ? 4 : 0)
         + (p.hasOwnProperty("CAPACITY") ? 2 : 0)
         + (p.hasOwnProperty("STATUS") ? 1 : 0)
}

function isOnlineCharger(supply) {
    return !isBatteryLike(supply) && !isPeripheral(supply) && supply.props.ONLINE === "1"
}

function chargerKind(supply) {
    var usbType = selectedOption(supply.props.USB_TYPE)
    var type = (usbType && usbType !== "Unknown") ? usbType : (supply.props.TYPE || "")
    if (/PD/.test(type)) return "usb_pd"
    if (/DCP|HVDCP|_HV|QC/.test(type)) return "usb_dcp"
    if (/CDP/.test(type)) return "usb_cdp"
    if (/SDP/.test(type)) return "usb_sdp"
    if (/Wireless|Wipower|WLC/i.test(type)) return "wireless"
    if (/USB/.test(type)) return "usb"
    if (type === "Mains") return "mains"
    return "charger"
}

function chargerRank(supply) {
    var kind = chargerKind(supply)
    return kind === "charger" ? 0 : (kind === "mains" ? 1 : 2)
}

function emptyInfo() {
    return {
        present: false,
        name: "",
        level: NaN,
        status: "unknown",
        currentMa: NaN,
        powerW: NaN,
        voltageV: NaN,
        temperatureC: NaN,
        designMah: NaN,
        fullMah: NaN,
        nowMah: NaN,
        designWh: NaN,
        fullWh: NaN,
        nowWh: NaN,
        healthPercent: NaN,
        healthSource: "",
        condition: "",
        cycleCount: NaN,
        technology: "",
        manufacturer: "",
        model: "",
        chargeType: "",
        timeToFullS: NaN,
        timeToEmptyS: NaN,
        charger: null
    }
}

function isPresent(value) {
    return value !== undefined && value !== null && value !== "" && !(typeof value === "number" && isNaN(value))
}

function firstValid(supplies, read, fallback) {
    for (var i = 0; i < supplies.length; ++i) {
        var value = read(supplies[i])
        if (isPresent(value))
            return value
    }
    return fallback === undefined ? NaN : fallback
}

function firstProp(supplies, key) {
    return firstValid(supplies, function (s) { return s.props[key] }, "")
}

var PLACEHOLDER_VALUES = ["unknown", "n/a", "none", "null"]

function knownOrEmpty(value) {
    return (value && PLACEHOLDER_VALUES.indexOf(String(value).toLowerCase()) < 0) ? value : ""
}

function firstKnownProp(supplies, key) {
    return firstValid(supplies, function (s) { return knownOrEmpty(s.props[key]) }, "")
}

var VENDOR_HEALTH_FILES = [
    { path: "age", kind: "percent" },
    { path: "fg_asoc", kind: "percent" },
    { path: "soh", kind: "percent" },
    { path: "state_of_health", kind: "percent" },
    { path: "battery_soh", kind: "percent" },
    { path: "/sys/class/battchg_ext/learned_capacity", kind: "learnedCapacity" }
]

function resolveVendorPath(file, primaryDir) {
    return file.path.charAt(0) === "/" ? file.path : primaryDir + "/" + file.path
}

function vendorHealthPaths(primaryDir) {
    return VENDOR_HEALTH_FILES.map(function (file) { return resolveVendorPath(file, primaryDir) })
}

function learnedCapacityMah(value, designMah) {
    var candidates = [value / 1000, value]
    for (var i = 0; i < candidates.length; ++i) {
        if (plausibleHealthRatio(candidates[i] / designMah))
            return candidates[i]
    }
    return NaN
}

var DEVICE_WORKAROUNDS = {
    enchilada: {
        designFromBatteryTypeName: true,
        chargeFullIsPlaceholder: true
    },
    fajita: {
        designFromBatteryTypeName: true,
        chargeFullIsPlaceholder: true
    },
    xqcc72: {
        batteryModelNameIsPlaceholder: true
    },
    thea: {
        chargeFullIsPlaceholder: true
    },
    titan: {
        chargeFullIsPlaceholder: true
    },
    pipa: {
        powerFromVoltageTimesCurrent: true,
        cycleCountFromChargeBandCounters: true
    }
}

function workaroundsFor(codename) {
    return DEVICE_WORKAROUNDS[codename] || {}
}

function deviceCodename(hwReleaseText) {
    var props = parseUevent(hwReleaseText)
    return (props.MER_HA_DEVICE || props.ID || "").replace(/"/g, "")
}

var NAMEPLATE_CAPACITY = /(\d{3,5})\s*mah/i

function nameplateMah(props) {
    var match = NAMEPLATE_CAPACITY.exec(props.BATTERY_TYPE || "")
    return match ? num(match[1]) : NaN
}

function designCapacityMah(batteries, workarounds) {
    var reported = firstValid(batteries, function (s) { return chargeMah(s.props.CHARGE_FULL_DESIGN) })
    if (!workarounds.designFromBatteryTypeName)
        return reported
    return firstValid(batteries, function (s) { return nameplateMah(s.props) }, reported)
}

function healthFromChargeFull(batteries, designMah, sysfsRoot) {
    for (var i = 0; i < batteries.length; ++i) {
        var full = chargeMah(batteries[i].props.CHARGE_FULL)
        if (Math.round(full) === Math.round(designMah))
            continue
        if (plausibleHealthRatio(full / designMah))
            return { percent: 100 * full / designMah, fullMah: full,
                     source: sysfsRoot + "/" + batteries[i].name + "/charge_full" }
    }
    return null
}

function healthFromEnergyFull(batteries, sysfsRoot) {
    for (var i = 0; i < batteries.length; ++i) {
        var p = batteries[i].props
        var full = num(p.ENERGY_FULL), design = num(p.ENERGY_FULL_DESIGN)
        if (full !== design && plausibleHealthRatio(full / design))
            return { percent: 100 * full / design, fullWh: energyWh(p.ENERGY_FULL),
                     source: sysfsRoot + "/" + batteries[i].name + "/energy_full" }
    }
    return null
}

function healthFromVendor(vendorValues, primaryDir, designMah, designWh) {
    for (var i = 0; i < VENDOR_HEALTH_FILES.length; ++i) {
        var file = VENDOR_HEALTH_FILES[i]
        var path = resolveVendorPath(file, primaryDir)
        var value = num(vendorValues[path])
        if (!(value > 0))
            continue
        var fullMah = file.kind === "learnedCapacity" ? learnedCapacityMah(value, designMah) : NaN
        if (has(fullMah))
            return { percent: 100 * fullMah / designMah, fullMah: fullMah, source: path }
        if (value <= MAX_HEALTH_PERCENT)
            return { percent: value, fullMah: designMah * value / 100, fullWh: designWh * value / 100, source: path }
    }
    return null
}

function averageOfChargeBandCounters(text) {
    var counters = String(text || "").trim().split(/\s+/).map(num).filter(has)
    if (counters.length === 0)
        return NaN
    var total = counters.reduce(function (sum, count) { return sum + count }, 0)
    return Math.round(total / counters.length)
}

function cycleCountCandidates(props, workarounds) {
    var candidates = [num(props.CYCLE_COUNT)]
    if (workarounds.cycleCountFromChargeBandCounters)
        candidates.push(averageOfChargeBandCounters(props.CYCLE_COUNTS))
    return candidates
}

function highestCycleCount(batteries, workarounds) {
    return batteries.reduce(function (highest, s) {
        return cycleCountCandidates(s.props, workarounds)
            .reduce(function (best, count) { return (count >= 0 && !(count <= best)) ? count : best }, highest)
    }, NaN)
}

function batteryPowerW(batteries, currentMa, voltageV, workarounds) {
    var measured = currentMa / 1000 * voltageV
    var reported = firstValid(batteries, function (s) { return powerW(s.props.POWER_NOW || s.props.POWER_AVG) })
    if (workarounds.powerFromVoltageTimesCurrent)
        return has(measured) ? measured : reported
    return has(reported) ? reported : measured
}

function agreesWithLevel(chargeMahValue, fullMah, level) {
    if (!has(level) || !has(fullMah))
        return true
    return Math.abs(100 * chargeMahValue / fullMah - level) <= MAX_REMAINING_CHARGE_LEVEL_MISMATCH
}

function remainingChargeMatchingLevel(batteries, fullMah, level) {
    return firstValid(batteries, function (s) {
        return [chargeMah(s.props.CHARGE_NOW), chargeMah(s.props.CHARGE_COUNTER)].filter(function (charge) {
            return has(charge) && agreesWithLevel(charge, fullMah, level)
        })[0]
    })
}

function driverTime(batteries, nowKey, avgKey) {
    return firstValid(batteries, function (s) {
        var t = num(s.props[nowKey])
        if (!(t > 0))
            t = num(s.props[avgKey])
        return t > 0 ? t : NaN
    })
}

function batteryStatus(statusText, level, chargerConnected) {
    switch (statusText.toLowerCase()) {
    case "charging": return "charging"
    case "discharging": return "discharging"
    case "full": return "full"
    case "not charging": return "notcharging"
    }
    if (chargerConnected)
        return level >= 100 ? "full" : "charging"
    return "discharging"
}

function chargerReading(chargers) {
    var voltage = firstValid(chargers, function (s) { return inputVoltageV(s.props.VOLTAGE_NOW) })
    var current = firstValid(chargers, function (s) { return positiveCurrentMa(s.props.CURRENT_NOW) })
    return {
        name: chargers[0].name,
        kind: chargerKind(chargers[0]),
        model: firstProp(chargers, "MODEL_NAME"),
        voltageV: voltage,
        currentMa: current,
        inputLimitMa: firstValid(chargers, function (s) { return positiveCurrentMa(s.props.INPUT_CURRENT_LIMIT) }),
        maxMa: firstValid(chargers, function (s) { return positiveCurrentMa(s.props.CURRENT_MAX) }),
        powerW: voltage * current / 1000
    }
}

function analyze(supplies, vendorValues, sysfsRoot, codename) {
    var info = emptyInfo()
    var workarounds = workaroundsFor(codename)
    sysfsRoot = sysfsRoot || "/sys/class/power_supply"

    var batteries = supplies.filter(isBatteryLike)
    if (batteries.length === 0)
        return info
    batteries.sort(function (a, b) { return primaryScore(b) - primaryScore(a) })
    var primary = batteries[0]
    var chargers = supplies.filter(isOnlineCharger)
    chargers.sort(function (a, b) { return chargerRank(b) - chargerRank(a) })

    info.present = true
    info.name = primary.name
    info.level = firstValid(batteries, function (s) {
        var c = num(s.props.CAPACITY)
        return c >= 0 && c <= 100 ? c : NaN
    })
    info.status = batteryStatus(firstProp(batteries, "STATUS"), info.level, chargers.length > 0)

    var rawVoltage = firstValid(batteries, function (s) { return s.props.VOLTAGE_NOW || s.props.VOLTAGE_AVG }, "")
    var milliunits = isMillivoltReading(rawVoltage)
    info.voltageV = voltageV(rawVoltage)
    info.currentMa = firstValid(batteries, function (s) {
        var c = currentMa(s.props.CURRENT_NOW, milliunits)
        return has(c) ? c : currentMa(s.props.CURRENT_AVG, milliunits)
    })
    info.powerW = batteryPowerW(batteries, info.currentMa, info.voltageV, workarounds)
    info.temperatureC = firstValid(batteries, function (s) { return temperatureC(s.props.TEMP) })

    info.designMah = designCapacityMah(batteries, workarounds)
    info.designWh = firstValid(batteries, function (s) { return energyWh(s.props.ENERGY_FULL_DESIGN) })
    info.nowWh = firstValid(batteries, function (s) { return energyWh(s.props.ENERGY_NOW) })

    var health = (workarounds.chargeFullIsPlaceholder ? null : healthFromChargeFull(batteries, info.designMah, sysfsRoot))
              || healthFromEnergyFull(batteries, sysfsRoot)
              || healthFromVendor(vendorValues || {}, sysfsRoot + "/" + primary.name, info.designMah, info.designWh)
    if (health) {
        info.healthPercent = health.percent
        info.healthSource = health.source
        info.fullMah = health.fullMah === undefined ? NaN : health.fullMah
        info.fullWh = health.fullWh === undefined ? NaN : health.fullWh
    }

    info.nowMah = remainingChargeMatchingLevel(batteries, has(info.fullMah) ? info.fullMah : info.designMah, info.level)

    info.condition = firstKnownProp(batteries, "HEALTH")
    info.cycleCount = highestCycleCount(batteries, workarounds)
    info.technology = firstKnownProp(batteries, "TECHNOLOGY")
    info.manufacturer = firstKnownProp(batteries, "MANUFACTURER")
    info.model = workarounds.batteryModelNameIsPlaceholder ? "" : firstKnownProp(batteries, "MODEL_NAME")
    info.chargeType = knownOrEmpty(primary.props.CHARGE_TYPE)
    info.timeToFullS = driverTime(batteries, "TIME_TO_FULL_NOW", "TIME_TO_FULL_AVG")
    info.timeToEmptyS = driverTime(batteries, "TIME_TO_EMPTY_NOW", "TIME_TO_EMPTY_AVG")

    if (chargers.length > 0)
        info.charger = chargerReading(chargers)
    return info
}

function linearRemainingSeconds(charging, level, now, full, rate) {
    if (!has(now) && has(full) && has(level))
        now = full * level / 100
    if (!has(now) || !has(full))
        return NaN
    var remaining = charging ? Math.max(full - now, 0) : now
    return 3600 * remaining / rate
}

function remainingSeconds(info, smoothedMa, smoothedW) {
    var charging = info.status === "charging"
    if (!charging && info.status !== "discharging")
        return NaN

    var driverEstimate = charging ? info.timeToFullS : info.timeToEmptyS
    if (has(driverEstimate))
        return driverEstimate

    if (smoothedMa > MIN_ESTIMABLE_MILLIAMPS) {
        var fromCharge = linearRemainingSeconds(charging, info.level, info.nowMah,
                                                has(info.fullMah) ? info.fullMah : info.designMah, smoothedMa)
        if (has(fromCharge))
            return fromCharge
    }
    if (smoothedW > MIN_ESTIMABLE_WATTS)
        return linearRemainingSeconds(charging, info.level, info.nowWh,
                                      has(info.fullWh) ? info.fullWh : info.designWh, smoothedW)
    return NaN
}

function smooth(previous, sample, weight) {
    if (!has(sample))
        return previous
    if (!has(previous))
        return sample
    return previous + weight * (sample - previous)
}
