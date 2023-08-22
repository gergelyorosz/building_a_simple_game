using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class CoinValue : MonoBehaviour
{
    [SerializeField]
    int coinValue = 0;
    // Start is called before the first frame update
    void Start()
    {
        if(coinValue == 0) {
            coinValue = Random.Range(1, 10);
            Debug.Log("Initialized coin with value " + coinValue);
        }
    }

    public int Value 
    {
        get
        {
            return coinValue;
        }
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
