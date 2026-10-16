// // ©2015 - 2024 Candy Smith
// // All rights reserved
// // Redistribution of this software is strictly not allowed.
// // Copy of this software can be obtained from unity asset store only.
// // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// // FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
// // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// // THE SOFTWARE.

using System.Collections;
using System.Collections.Generic;
using BubbleShooterGameToolkit.Scripts.Audio;
using BubbleShooterGameToolkit.Scripts.CommonUI.Reward;
using BubbleShooterGameToolkit.Scripts.Settings;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Popups
{
    public class LuckySpin : PopupWithCurrencyLabel
    {
        public float velocity;
        public float stoptime;
        
        [SerializeField]
        private GameObject spin;
        [SerializeField]
        List<Image> lights = new();

        public Button freeSpinButton;
        public Button buySpinButton;
        public Button rewardedAdButton;
        public RewardSettingSpin[] spinRewards;
        public List<RewardVisual> rewards = new List<RewardVisual>();
        private SpinSettings spinSettings;
        private Rigidbody2D rb;
        private bool isSpinning = false;
        private int previousRotationMarker;

        private void OnEnable()
        {
            rb = spin.GetComponent<Rigidbody2D>();
            freeSpinButton.onClick.AddListener(FreeSpin);
            buySpinButton.onClick.AddListener(BuySpin);
            var isFirstSpin = PlayerPrefs.GetInt("FreeSpin", 0) == 0;
            freeSpinButton.gameObject.SetActive(isFirstSpin);
            buySpinButton.gameObject.SetActive(!isFirstSpin);
            rewardedAdButton.gameObject.SetActive(!isFirstSpin);
            spinSettings = Resources.Load<SpinSettings>("Settings/SpinSettings");
            DefineRewards(spinSettings.rewards);
            StartCoroutine(SwitchLightsAlpha());
        }

        private IEnumerator SwitchLightsAlpha()
        {
            const float maxSpeed = 100;

            while (true)
            {
                float speedRatio = Mathf.Abs(rb.angularVelocity) / maxSpeed; // Ratio of the current speed to the maximum speed
                speedRatio = Mathf.Min(speedRatio, .9f);
                float delay = 1f - speedRatio; // Higher speed -> smaller delay
                yield return new WaitForSeconds(delay);

                foreach (var light in lights)
                {
                    light.color = new Color(light.color.r, light.color.g, light.color.b, light.color.a == 0 ? 1 : 0);
                }
            }
        }

        public void DefineRewards(RewardSettingSpin[] spinRewards)
        {
            this.spinRewards = spinRewards;
            foreach (var reward in spinRewards)
            {
                var obj = Instantiate(reward.rewardVisualPrefab, spin.transform);
                //rotate to 360/number of rewards
                obj.transform.RotateAround(spin.transform.position, Vector3.forward, 360f / spinRewards.Length * obj.transform.GetSiblingIndex());
                obj.SetCount(reward.count);
                rewards.Add(obj);
            }
        }

        private void BuySpin()
        {
            if (GameManager.instance.coins.Consume(spinSettings.costToSpin))
            {
                ShowCoinsSpendFX(buySpinButton.transform.position);
                Spin();
            }
        }

        public void Spin()
        {
            StartCoroutine(StartSpin());
        }

        private void FreeSpin()
        {
            PlayerPrefs.SetInt("FreeSpin", 1);
            Spin();
        }

        private IEnumerator StartSpin()
        {
            freeSpinButton.interactable = false;
            buySpinButton.interactable = false;
            rewardedAdButton.interactable = false;

            float randomVelocity = velocity * Random.Range(0.8f, 2f);

            float timeElapsed = 0;
            isSpinning = true;
            previousRotationMarker = Mathf.FloorToInt(spin.transform.eulerAngles.z / 25);
            
            while(timeElapsed < stoptime)
            {
                var appliedTorque = Mathf.Lerp(0, randomVelocity, timeElapsed / stoptime);
                rb.AddTorque(appliedTorque);
                timeElapsed += Time.deltaTime;
                yield return new WaitForFixedUpdate();
            }

            rb.angularDrag *= 100;
            yield return new WaitWhile(() => rb.angularVelocity != 0);
            isSpinning = false;
            CheckReward(GetWinReward());
        }
        
        private void Update()
        {
            if(isSpinning)
            {
                CheckPlaySound();
            }
        }
        
        private void CheckPlaySound()
        {
            float currentZRotation = spin.transform.eulerAngles.z;
            int currentTenDegreeMarker = Mathf.FloorToInt(currentZRotation / 25);

            if (currentTenDegreeMarker != previousRotationMarker)
            {
                SoundBase.instance.PlaySound(SoundBase.instance.luckySpin);
                previousRotationMarker = currentTenDegreeMarker;
            }
        }

        private int GetWinReward()
        {
            int highestYIndex = 0; // Start with first item's index
            float highestY = rewards[0].transform.position.y; // and its 'y' position

            for (int i = 1; i < rewards.Count; i++)
            {
                // If current item's 'y' position is higher
                if (rewards[i].transform.position.y > highestY)
                {
                    highestY = rewards[i].transform.position.y;
                    highestYIndex = i;
                }
            }
            return highestYIndex;
        }

        public void CheckReward(int rewardIndex)
        {
            Close();
            
            var rewardPopup = MenuManager.instance.ShowPopup<RewardPopup>();
            rewardPopup.SetReward(spinRewards[rewardIndex]);

        }
    }
}