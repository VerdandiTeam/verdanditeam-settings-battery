import QtQuick 2.0
import Sailfish.Silica 1.0
import "../storage"

Item {
    id: root

    property real healthPercent: NaN
    property string fullText
    property string designText
    property color healthColor: Theme.highlightColor

    readonly property bool known: !isNaN(healthPercent)

    width: parent.width
    height: circle.height + 2 * Theme.paddingLarge

    DiskUsageCircle {
        id: circle

        anchors.centerIn: parent
        value: root.known ? Math.min(Math.max(root.healthPercent / 100, 0), 1) : 0
        progressColor: root.healthColor
        Behavior on value { NumberAnimation { duration: 400; easing.type: Easing.InOutQuad } }

        DiskUsageLabelGroup {
            width: parent.width * 0.7
            anchors.centerIn: parent
            topLabelText: root.known ? "%1%".arg(Math.round(root.healthPercent)) : "–"
            bottomLabelText: qsTr("Health")
        }
    }

    DiskUsageLabelGroup {
        anchors {
            left: parent.left
            leftMargin: Theme.horizontalPageMargin
            right: circle.left
            rightMargin: Theme.paddingMedium
            verticalCenter: parent.verticalCenter
        }
        ruler.width: width * 0.7
        horizontalAlignment: Text.AlignLeft
        visible: root.known && root.fullText !== ""
        topLabelText: root.fullText
        bottomLabelText: qsTr("Full charge")
    }

    DiskUsageLabelGroup {
        anchors {
            left: circle.right
            leftMargin: Theme.paddingMedium
            right: parent.right
            rightMargin: Theme.horizontalPageMargin
            verticalCenter: parent.verticalCenter
        }
        ruler.width: width * 0.7
        horizontalAlignment: Text.AlignRight
        visible: root.designText !== ""
        topLabelText: root.designText
        bottomLabelText: qsTr("Design")
    }
}
