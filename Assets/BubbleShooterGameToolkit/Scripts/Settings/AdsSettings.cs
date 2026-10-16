using System;
using BubbleShooterGameToolkit.Scripts.Ads;
using BubbleShooterGameToolkit.Scripts.Ads.AdUnits;
using BubbleShooterGameToolkit.Scripts.CommonUI.Popups;
using UnityEngine;
using UnityEngine.Serialization;

namespace BubbleShooterGameToolkit.Scripts.Settings
{
    public class AdsSettings : ScriptableObject
    {
        [FormerlySerializedAs("adElements")]
        public AdSetting[] adProfiles;
    }

    [Serializable]
    public class AdSetting
    {
        public string name;
        public bool enable = true;
        public bool testInEditor;
        public EPlatforms platforms;
        public string appId;
        public AdsHandlerBase adsHandler;
        public AdElement[] adElements;
    }

    [Serializable]
    public class AdElement
    {
        public string placementId;
        public AdReference adReference;
        [Header("Popup that triggers Interstitial ads")]
        public PopupEventAdsSetting popup;
    }

    [Serializable]
    public class PopupEventAdsSetting
    {
        public Popup popup;
        public bool showOnOpen;
        public bool showOnClose;
    }

    public enum EPlatforms
    {
        Android,
        IOS,
        Windows,
        WebGL
    }
}