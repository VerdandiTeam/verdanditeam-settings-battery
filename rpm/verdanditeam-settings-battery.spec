Name:       verdanditeam-settings-battery
Version:    0.1.0
Release:    1
Summary:    Battery rate, health and charger details in Settings → Battery
License:    BSD-3-Clause and Proprietary
BuildArch:  noarch
Source0:    %{name}-%{version}.tar.gz
Requires:   jolla-settings-system >= 1.2.95
Requires:   qt5-qtdeclarative-import-folderlistmodel

%define pagedir %{_datadir}/jolla-settings/pages/verdanditeam-battery

%description
Extends Settings → System → Battery with the storage page's circle widgets:
charge level with charge/discharge rate and time remaining, battery health
(measured full-charge capacity against design capacity), cycle count,
voltage, current, temperature and charger type.

Reads /sys/class/power_supply directly and handles common driver quirks
(units, current sign, fake full-charge capacity, vendor health nodes), so
it works across devices without per-device configuration.

The page is wired in by a settings entry that redefines the
system_settings/system/battery path (the same way verdandiupdater replaces
the OS updates page). No files of jolla-settings-system are touched;
removing this package brings the stock page back.

%prep
%setup -q

%build

%install
install -d %{buildroot}%{pagedir}
install -m 0644 qml/*.qml qml/*.js %{buildroot}%{pagedir}/
install -D -m 0644 entries/verdanditeam-battery.json \
    %{buildroot}%{_datadir}/jolla-settings/entries/verdanditeam-battery.json

%files
%{pagedir}
%{_datadir}/jolla-settings/entries/verdanditeam-battery.json
