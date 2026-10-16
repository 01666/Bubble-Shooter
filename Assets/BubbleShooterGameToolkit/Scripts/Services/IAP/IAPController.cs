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

using System;
using System.Collections.Generic;
using UnityEngine;
#if UNITY_PURCHASING
using UnityEngine.Purchasing;
using UnityEngine.Purchasing.Extension;
#endif

namespace BubbleShooterGameToolkit.Scripts.Services
{
#if UNITY_PURCHASING

    public class IAPController : IDetailedStoreListener, IIAPService
    {
        private static IStoreController storeController;

        public static event Action<string> OnSuccessfulPurchase;

        public void InitializePurchasing(IEnumerable<string> products)
        {
            if (IsInitialized())
            {
                return;
            }
            
            var builder = ConfigurationBuilder.Instance(StandardPurchasingModule.Instance());

            foreach (var productId in products)
            {
                builder.AddProduct(productId, ProductType.Consumable);
            }

            UnityPurchasing.Initialize(this, builder);
        }

        public bool IsInitialized()
        {
            return storeController != null;
        }

        public void BuyProduct(string productId)
        {
            try
            {
                if (IsInitialized())
                {
                    Product product = storeController.products.WithID(productId);

                    if (product != null && product.availableToPurchase)
                    {
                        Debug.Log(string.Format("Purchasing product asychronously: '{0}'", product.definition.id));
                        storeController.InitiatePurchase(product);
                    }
                    else
                    {
                        Debug.Log("BuyProductID: FAIL. Not purchasing product, either is not found or is not available for purchase");
                    }
                }
                else
                {
                    Debug.Log("BuyProductID FAIL. Not initialized.");
                }
            }
            catch (Exception e)
            {
                Debug.Log("BuyProductID: FAIL. Exception during purchase. " + e);
            }
        }
        
        public decimal GetProductLocalizedPrice(string productId)
        {
            if (IsInitialized())
            {
                Product product = storeController.products.WithID(productId);
                if (product != null)
                {
                    return product.metadata.localizedPrice;
                }
            }

            return 0m;
        }

        public string GetProductLocalizedPriceString(string productId)
        {
            if (IsInitialized())
            {
                Product product = storeController.products.WithID(productId);
                if (product != null) 
                {
                    return product.metadata.localizedPriceString;
                }
            }

            return string.Empty;
        }

        public void OnInitialized(IStoreController controller, IExtensionProvider extensions)
        {
            Debug.Log("In-App Purchasing successfully initialized");
            storeController = controller;
        }

        public void OnPurchaseFailed(Product product, PurchaseFailureDescription failureDescription)
        {
            Debug.Log("OnPurchaseFailed: FAIL. Product: " + product.definition.id + " PurchaseFailureDescription: " + failureDescription);
        }
        
        public void OnPurchaseFailed(Product i, PurchaseFailureReason p)
        {
            Debug.Log($"OnPurchaseFailed: FAIL. Product: '{i.definition.id}', PurchaseFailureReason: {p}");
        }

        public void OnInitializeFailed(InitializationFailureReason reason)
        {
            Debug.Log("OnInitializeFailed InitializationFailureReason:" + reason);
        }

        public void OnInitializeFailed(InitializationFailureReason error, string message)
        {
            Debug.Log("OnInitializeFailed InitializationFailureReason:" + error + " message: " + message);
        }

        public PurchaseProcessingResult ProcessPurchase(PurchaseEventArgs args)
        {
            Debug.Log($"ProcessPurchase: PASS. Product: '{args.purchasedProduct.definition.id}'");
        
            OnSuccessfulPurchase?.Invoke(args.purchasedProduct.definition.id);
        
            return PurchaseProcessingResult.Complete;
        }
    }
#endif
}