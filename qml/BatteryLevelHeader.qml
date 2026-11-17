import QtQuick 2.2
import Sailfish.Silica 1.0
import "../storage"

Item {
    id: root

    property var info
    property real rateWatts: NaN
    property real rateMa: NaN
    property real remainingSeconds: NaN
    property string chargerLabel

    readonly property bool charging: info.status === "charging"
    readonly property bool flowing: charging || info.status === "discharging"
    readonly property bool low: info.level <= 15 && !charging
    readonly property bool hasEstimate: remainingSeconds > 0

    function formatNumber(value, decimals) {
        return Number(value).toLocaleString(Qt.locale(), "f", decimals)
    }

    function formatDuration(seconds) {
        var minutes = Math.round(seconds / 60)
        if (minutes < 60)
            return qsTr("%1 min").arg(minutes)
        var hours = Math.floor(minutes / 60)
        if (hours >= 48)
            return qsTr("%1 d").arg(Math.round(hours / 24))
        return qsTr("%1 h %2 min").arg(hours).arg(("0" + (minutes % 60)).slice(-2))
    }

    function statusText(status) {
        switch (status) {
        case "charging": return qsTr("Charging")
        case "discharging": return qsTr("Discharging")
        case "full": return qsTr("Full")
        case "notcharging": return qsTr("Not charging")
        default: return qsTr("Battery")
        }
    }

    width: parent.width
    height: circle.height + 2 * Theme.paddingLarge

    DiskUsageCircle {
        id: circle

        anchors.centerIn: parent
        highlighted: root.low
        value: isNaN(root.info.level) ? 0 : root.info.level / 100
        Behavior on value { NumberAnimation { duration: 400; easing.type: Easing.InOutQuad } }

        DiskUsageLabelGroup {
            width: parent.width * 0.7
            anchors.centerIn: parent
            highlighted: root.low
            topLabelText: isNaN(root.info.level) ? "–" : "%1%".arg(root.info.level)
            bottomLabelText: root.statusText(root.info.status)
        }
    }

    DiskUsageCircle {
        id: chargingArc

        anchors.centerIn: circle
        width: circle.width
        value: 1/12
        backgroundColor: "transparent"
        progressColor: Theme.highlightColor
        opacity: root.charging ? Theme.opacityHigh : 0.0
        visible: opacity > 0
        Behavior on opacity { FadeAnimation {} }
        RotationAnimator on rotation {
            from: 0; to: 360
            duration: 4000
            loops: Animation.Infinite
            running: root.charging && Qt.application.active
        }
    }

    DiskUsageLabelGroup {
        id: rateLabels

        anchors {
            left: parent.left
            leftMargin: Theme.horizontalPageMargin
            right: circle.left
            rightMargin: Theme.paddingMedium
            verticalCenter: parent.verticalCenter
        }
        ruler.width: width * 0.7
        horizontalAlignment: Text.AlignLeft
        visible: root.flowing
        topLabelText: !isNaN(root.rateWatts)
                      ? qsTr("%1 W").arg(root.formatNumber(root.rateWatts, root.rateWatts < 10 ? 2 : 1))
                      : (!isNaN(root.rateMa) ? qsTr("%1 mA").arg(Math.round(root.rateMa)) : "–")
        bottomLabelText: root.charging ? (root.chargerLabel !== "" ? root.chargerLabel : qsTr("In"))
                                       : qsTr("Out")
    }

    DiskUsageLabelGroup {
        id: estimateOrTemperatureLabels

        anchors {
            left: circle.right
            leftMargin: Theme.paddingMedium
            right: parent.right
            rightMargin: Theme.horizontalPageMargin
            verticalCenter: parent.verticalCenter
        }
        ruler.width: width * 0.7
        horizontalAlignment: Text.AlignRight
        visible: topLabelText !== ""
        topLabelText: {
            if (root.hasEstimate)
                return "≈" + root.formatDuration(root.remainingSeconds)
            if (!isNaN(root.info.temperatureC))
                return qsTr("%1 °C").arg(root.formatNumber(root.info.temperatureC, 1))
            return ""
        }
        bottomLabelText: {
            if (root.hasEstimate)
                return root.charging ? qsTr("Until full") : qsTr("Remaining")
            return qsTr("Temperature")
        }
    }
}
