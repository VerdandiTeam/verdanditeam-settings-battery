import QtQuick 2.0
import Qt.labs.folderlistmodel 2.1
import "batteryinfo.js" as BI

Item {
    id: root

    property bool active
    property int interval: 2000
    readonly property string sysfsRoot: "/sys/class/power_supply"
    readonly property real smoothingWeight: 0.3

    property var info: BI.emptyInfo()
    property bool initialized
    property real smoothedCurrentMa: NaN
    property real smoothedPowerW: NaN
    readonly property real remainingSeconds: BI.remainingSeconds(info, smoothedCurrentMa, smoothedPowerW)

    readonly property var wellKnownSupplyNames: ["battery", "bms", "BAT0", "BAT1", "main-battery", "Battery",
                                                 "max170xx_battery", "bq27000-battery", "bq27500-0", "axp20x-battery",
                                                 "rk-bat", "sbs-battery", "usb", "ac", "AC", "ADP1", "wireless", "charger"]

    property string _deviceCodename
    property bool _deviceCodenameLoaded

    property var _supplyNames: []
    property var _existingVendorHealthPaths: []
    property int _generation
    property string _lastStatus

    function _read(path, callback) {
        var xhr = new XMLHttpRequest()
        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE)
                callback(xhr.responseText || "")
        }
        xhr.open("GET", "file://" + path)
        xhr.send()
    }

    function _listSupplies() {
        var names = []
        for (var i = 0; i < folderModel.count; ++i)
            names.push(folderModel.get(i, "fileName"))
        _supplyNames = names.length > 0 ? names : wellKnownSupplyNames
    }

    function refresh() {
        var generation = ++_generation
        var supplies = []
        var vendorValues = {}
        var pending = _supplyNames.length + _existingVendorHealthPaths.length

        var finishOne = function() {
            if (--pending === 0 && generation === _generation)
                _apply(supplies, vendorValues)
        }

        _supplyNames.forEach(function(name) {
            _read(sysfsRoot + "/" + name + "/uevent", function(text) {
                if (text.length > 0)
                    supplies.push({ name: name, props: BI.parseUevent(text) })
                finishOne()
            })
        })
        _existingVendorHealthPaths.forEach(function(path) {
            _read(path, function(text) {
                vendorValues[path] = text.trim()
                finishOne()
            })
        })
    }

    function _byName(a, b) {
        return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0)
    }

    function _isGaugeBetweenUpdates(sample, next) {
        var flowing = next.status === "charging" || next.status === "discharging"
        return flowing && sample === 0
    }

    function _updateSmoothedRates(next) {
        if (next.status !== _lastStatus) {
            smoothedCurrentMa = NaN
            smoothedPowerW = NaN
            _lastStatus = next.status
        }
        if (!_isGaugeBetweenUpdates(next.currentMa, next))
            smoothedCurrentMa = BI.smooth(smoothedCurrentMa, next.currentMa, smoothingWeight)
        if (!_isGaugeBetweenUpdates(next.powerW, next))
            smoothedPowerW = BI.smooth(smoothedPowerW, next.powerW, smoothingWeight)
    }

    function _apply(supplies, vendorValues) {
        var next = BI.analyze(supplies.sort(_byName), vendorValues, sysfsRoot, _deviceCodename)
        _updateSmoothedRates(next)
        info = next
        if (!initialized) {
            initialized = true
            if (next.present)
                _findExistingVendorHealthFiles(next.name)
        }
    }

    function _findExistingVendorHealthFiles(primaryName) {
        var candidates = BI.vendorHealthPaths(sysfsRoot + "/" + primaryName)
        var existing = []
        var pending = candidates.length
        candidates.forEach(function(path) {
            _read(path, function(text) {
                if (text.trim().length > 0)
                    existing.push(path)
                if (--pending === 0 && existing.length > 0) {
                    _existingVendorHealthPaths = existing
                    refresh()
                }
            })
        })
    }

    FolderListModel {
        id: folderModel
        folder: "file://" + root.sysfsRoot
        showDirs: true
        showFiles: true
        showDotAndDotDot: false
        sortField: FolderListModel.Name
        onCountChanged: root._listSupplies()
    }

    Timer {
        interval: root.interval
        repeat: true
        triggeredOnStart: true
        running: root.active && root._deviceCodenameLoaded
        onTriggered: root.refresh()
    }

    Component.onCompleted: {
        _listSupplies()
        _read("/etc/hw-release", function(text) {
            _deviceCodename = BI.deviceCodename(text)
            _deviceCodenameLoaded = true
        })
    }
}
