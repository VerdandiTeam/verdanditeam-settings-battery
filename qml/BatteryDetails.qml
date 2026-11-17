import QtQuick 2.0
import Sailfish.Silica 1.0

Column {
    id: root

    property alias active: batteryInfo.active

    readonly property var info: batteryInfo.info
    readonly property var charger: info.charger
    readonly property bool energyUnits: isNaN(info.designMah) && !isNaN(info.designWh)
    readonly property real designCapacity: energyUnits ? info.designWh : info.designMah
    readonly property real fullCapacity: energyUnits ? info.fullWh : info.fullMah
    readonly property var storagePagePalette: ({ good: "#519C3F", worn: "#BFA058", poor: "#B35F54" })

    function formatNumber(value, decimals) {
        return Number(value).toLocaleString(Qt.locale(), "f", decimals)
    }

    function capacityText(value) {
        return isNaN(value) ? ""
             : energyUnits ? qsTr("%1 Wh").arg(formatNumber(value, 1))
                           : qsTr("%1 mAh").arg(Math.round(value))
    }

    function healthColor(percent) {
        return percent >= 80 ? storagePagePalette.good
             : percent >= 60 ? storagePagePalette.worn
                             : storagePagePalette.poor
    }

    function conditionText(health) {
        switch (health) {
        case "Good": return qsTr("Good")
        case "Overheat": case "Hot": return qsTr("Overheated")
        case "Warm": return qsTr("Warm")
        case "Cool": return qsTr("Cool")
        case "Cold": return qsTr("Cold")
        case "Dead": return qsTr("Dead")
        case "Over voltage": return qsTr("Over voltage")
        case "Over current": return qsTr("Over current")
        case "Calibration required": return qsTr("Calibration required")
        default: return health
        }
    }

    function chargerText(kind) {
        switch (kind) {
        case "usb_pd": return qsTr("USB Power Delivery")
        case "usb_dcp": return qsTr("USB wall charger")
        case "usb_cdp": return qsTr("USB charging port")
        case "usb_sdp": return qsTr("USB (computer)")
        case "usb": return qsTr("USB")
        case "wireless": return qsTr("Wireless")
        case "mains": return qsTr("Power adapter")
        default: return qsTr("Connected")
        }
    }

    function chargerInputText() {
        if (!charger)
            return ""
        var parts = []
        if (!isNaN(charger.voltageV))
            parts.push(qsTr("%1 V").arg(formatNumber(charger.voltageV, 2)))
        if (!isNaN(charger.currentMa))
            parts.push(qsTr("%1 mA").arg(Math.round(charger.currentMa)))
        if (!isNaN(charger.powerW))
            parts.push(qsTr("%1 W").arg(formatNumber(charger.powerW, 1)))
        return parts.join(" · ")
    }

    width: parent.width
    visible: info.present
    opacity: batteryInfo.initialized ? 1.0 : 0.0
    Behavior on opacity { FadeAnimation {} }

    BatteryInfo {
        id: batteryInfo
    }

    BatteryLevelHeader {
        info: root.info
        rateWatts: batteryInfo.smoothedPowerW
        rateMa: batteryInfo.smoothedCurrentMa
        remainingSeconds: batteryInfo.remainingSeconds
        chargerLabel: root.charger && root.charger.kind !== "charger" ? root.chargerText(root.charger.kind) : ""
    }

    SectionHeader {
        text: qsTr("Battery health")
    }

    BatteryHealthCircle {
        healthPercent: root.info.healthPercent
        healthColor: root.healthColor(root.info.healthPercent)
        fullText: root.capacityText(root.fullCapacity)
        designText: root.capacityText(root.designCapacity)
    }

    Label {
        x: Theme.horizontalPageMargin
        width: parent.width - 2*x
        height: implicitHeight + Theme.paddingMedium
        visible: isNaN(root.info.healthPercent)
        color: Theme.secondaryHighlightColor
        wrapMode: Text.Wrap
        font.pixelSize: Theme.fontSizeExtraSmall
        text: qsTr("This device doesn't report a measured battery capacity, so the wear level can't be shown.")
    }

    DetailItem {
        label: qsTr("Condition")
        value: root.conditionText(root.info.condition)
        visible: value !== ""
    }
    DetailItem {
        label: qsTr("Charge cycles")
        value: root.info.cycleCount
        visible: !isNaN(root.info.cycleCount)
    }
    DetailItem {
        label: qsTr("Technology")
        value: root.info.technology
        visible: value !== ""
    }
    DetailItem {
        label: qsTr("Manufacturer")
        value: [root.info.manufacturer, root.info.model].filter(function(s) { return s !== "" }).join(" ")
        visible: value !== ""
    }

    SectionHeader {
        text: qsTr("Now")
    }

    DetailItem {
        label: root.info.status === "charging" ? qsTr("Charging current") : qsTr("Discharge current")
        value: qsTr("%1 mA").arg(Math.round(batteryInfo.smoothedCurrentMa))
        visible: !isNaN(batteryInfo.smoothedCurrentMa)
    }
    DetailItem {
        label: qsTr("Power")
        value: qsTr("%1 W").arg(root.formatNumber(batteryInfo.smoothedPowerW, 2))
        visible: !isNaN(batteryInfo.smoothedPowerW)
    }
    DetailItem {
        label: qsTr("Voltage")
        value: qsTr("%1 V").arg(root.formatNumber(root.info.voltageV, 3))
        visible: !isNaN(root.info.voltageV)
    }
    DetailItem {
        label: qsTr("Temperature")
        value: qsTr("%1 °C").arg(root.formatNumber(root.info.temperatureC, 1))
        visible: !isNaN(root.info.temperatureC)
    }
    DetailItem {
        label: qsTr("Charger")
        value: root.charger ? root.chargerText(root.charger.kind) : ""
        visible: value !== ""
    }
    DetailItem {
        label: qsTr("Charging mode")
        value: root.info.chargeType
        visible: value !== "" && root.info.status === "charging"
    }
    DetailItem {
        label: qsTr("Charger input")
        value: root.chargerInputText()
        visible: value !== ""
    }
    DetailItem {
        label: qsTr("Input current limit")
        value: root.charger && !isNaN(root.charger.inputLimitMa) ? qsTr("%1 mA").arg(Math.round(root.charger.inputLimitMa)) : ""
        visible: value !== ""
    }
}
